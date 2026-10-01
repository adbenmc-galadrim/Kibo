#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::ipc::CapabilityBuilder;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tauri_plugin_window_state::StateFlags;

mod menu;

struct Daemon(Mutex<Option<CommandChild>>);

fn take_daemon(app: &AppHandle) -> Option<CommandChild> {
    app.state::<Daemon>().0.lock().expect("daemon lock").take()
}

#[derive(Deserialize, Debug, PartialEq)]
struct Notice {
    title: String,
    body: String,
}

fn parse_notice(line: &str) -> Option<Result<Notice, serde_json::Error>> {
    line.strip_prefix("KIBO_NOTIFY ").map(serde_json::from_str)
}

fn ipc_origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

fn parse_sandbox(line: &str) -> Option<&str> {
    line.strip_prefix("KIBO_SANDBOX ")
}

fn navigation_allowed(target: &Url, allowed: &[String]) -> bool {
    allowed.contains(&ipc_origin(target))
}

fn parse_daemon_url(raw: &str) -> Result<Url, String> {
    raw.parse()
        .map_err(|e| format!("le démon a donné une adresse invalide « {raw} » ({e})"))
}

fn parse_ready_line(line: &str) -> Option<Result<Url, String>> {
    line.strip_prefix("KIBO_READY ").map(parse_daemon_url)
}

fn stop_message(reason: &str) -> String {
    format!("Kibo s'est arrêté : {reason}. Relance l'application.")
}

fn daemon_exit_message(code: Option<i32>) -> String {
    match code {
        Some(code) => format!("le démon a quitté (code {code})"),
        None => "le démon a quitté".into(),
    }
}

const MIN_WINDOW: (f64, f64) = (960.0, 600.0);
const WINDOW_STATE: StateFlags = StateFlags::SIZE
    .union(StateFlags::POSITION)
    .union(StateFlags::MAXIMIZED);

#[derive(Serialize)]
struct OpenUrlScope {
    url: String,
}

impl OpenUrlScope {
    fn https() -> Self {
        Self {
            url: "https://**".into(),
        }
    }
}

const PLAIN_PERMISSIONS: &[&str] = &[
    "updater:default",
    "process:allow-restart",
    "core:app:allow-version",
    "core:window:allow-set-title",
    "dialog:allow-open",
];

fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder {
    let mut capability = CapabilityBuilder::new("daemon")
        .window("main")
        .local(false)
        .remote(ipc_origin(daemon_url));
    for permission in PLAIN_PERMISSIONS {
        capability = capability.permission(*permission);
    }
    capability.permission_scoped(
        "opener:allow-open-url",
        vec![OpenUrlScope::https()],
        Vec::<OpenUrlScope>::new(),
    )
}

#[derive(Default)]
struct StartupState {
    ready: Option<Url>,
}

fn show_notice(handle: &AppHandle, notice: Result<Notice, serde_json::Error>) {
    match notice {
        Ok(n) => {
            if let Err(e) = handle
                .notification()
                .builder()
                .title(n.title)
                .body(n.body)
                .show()
            {
                eprintln!("[kibo] notification failed: {e}");
            }
        }
        Err(e) => eprintln!("[kibo] invalid notification from the daemon: {e}"),
    }
}

fn open_main_window(handle: &AppHandle, url: Url, sandbox: &Url) -> Result<(), String> {
    let allowed = vec![ipc_origin(&url), ipc_origin(sandbox)];
    WebviewWindowBuilder::new(handle, "main", WebviewUrl::External(url))
        .on_navigation(move |target| navigation_allowed(target, &allowed))
        .title("Kibo")
        .inner_size(1440.0, 900.0)
        .min_inner_size(MIN_WINDOW.0, MIN_WINDOW.1)
        .build()
        .map_err(|e| format!("impossible d'ouvrir la fenêtre ({e})"))?;
    Ok(())
}

fn handle_daemon_line(
    handle: &AppHandle,
    line: &str,
    state: &mut StartupState,
) -> Result<(), String> {
    if let Some(notice) = parse_notice(line) {
        show_notice(handle, notice);
        return Ok(());
    }
    if let Some(url) = parse_ready_line(line) {
        let url = url?;
        handle
            .add_capability(daemon_capability(&url))
            .map_err(|e| format!("impossible d'autoriser l'adresse du démon ({e})"))?;
        state.ready = Some(url);
        return Ok(());
    }
    let Some(sandbox) = parse_sandbox(line) else {
        return Ok(());
    };
    let sandbox = parse_daemon_url(sandbox)?;
    let url = state
        .ready
        .take()
        .ok_or_else(|| "le démon a annoncé son bac à sable avant d'être prêt".to_string())?;
    open_main_window(handle, url, &sandbox)?;
    if std::env::var("KIBO_SMOKE").is_ok() {
        handle.exit(0);
    }
    Ok(())
}

fn handle_daemon_event(
    handle: &AppHandle,
    event: CommandEvent,
    state: &mut StartupState,
) -> Result<(), String> {
    match event {
        CommandEvent::Stdout(line) => {
            handle_daemon_line(handle, String::from_utf8_lossy(&line).trim(), state)
        }
        CommandEvent::Terminated(payload) if take_daemon(handle).is_some() => {
            Err(daemon_exit_message(payload.code))
        }
        _ => Ok(()),
    }
}

fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(WINDOW_STATE)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init());
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(menu::build)
        .on_menu_event(|app, event| menu::on_event(app, event.id().as_ref()));
    let app = builder
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let ui_dir = resource_dir.join("ui");
            let toolchain_dir = resource_dir.join("toolchain");
            let builtin_dir = resource_dir.join("builtin");
            let (mut events, child) = app
                .shell()
                .sidecar("kibo-daemon")?
                .env("KIBO_NATIVE_NOTIFY", "1")
                .env(
                    "KIBO_BUILTIN_DIR",
                    builtin_dir.to_string_lossy().to_string(),
                )
                .args([
                    "--port",
                    "0",
                    "--ui",
                    &ui_dir.to_string_lossy(),
                    "--toolchain",
                    &toolchain_dir.to_string_lossy(),
                ])
                .spawn()?;
            app.manage(Daemon(Mutex::new(Some(child))));
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut state = StartupState::default();
                while let Some(event) = events.recv().await {
                    if let Err(reason) = handle_daemon_event(&handle, event, &mut state) {
                        eprintln!("{}", stop_message(&reason));
                        std::process::exit(1);
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("cannot build the Kibo app");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(child) = take_daemon(app) {
                let _ = child.kill();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_notice_line() {
        let notice = parse_notice(r#"KIBO_NOTIFY {"title":"a","body":"b"}"#)
            .unwrap()
            .unwrap();
        assert_eq!(
            notice,
            Notice {
                title: "a".into(),
                body: "b".into()
            }
        );
    }

    #[test]
    fn ignores_other_lines() {
        assert!(parse_notice("KIBO_READY http://127.0.0.1:4317/").is_none());
    }

    #[test]
    fn reports_invalid_json() {
        assert!(parse_notice("KIBO_NOTIFY {").unwrap().is_err());
    }

    #[test]
    fn grants_the_daemon_origin_only() {
        let url: Url = "http://127.0.0.1:4317/?token=abc#/settings"
            .parse()
            .unwrap();
        assert_eq!(ipc_origin(&url), "http://127.0.0.1:4317");
    }

    fn allowed() -> Vec<String> {
        vec![
            "http://127.0.0.1:4317".into(),
            "http://127.0.0.1:4318".into(),
        ]
    }

    fn navigates(target: &str, allowed: &[String]) -> bool {
        navigation_allowed(&target.parse().unwrap(), allowed)
    }

    #[test]
    fn navigation_stays_on_the_daemon_and_sandbox_origins() {
        assert!(navigates(
            "http://127.0.0.1:4317/?token=abc#/settings",
            &allowed()
        ));
        assert!(navigates("http://127.0.0.1:4317/", &allowed()));
        assert!(navigates(
            "http://127.0.0.1:4318/c/kanban/1.0.0/abc/index.html",
            &allowed()
        ));
    }

    #[test]
    fn navigation_elsewhere_is_refused() {
        for target in [
            "http://127.0.0.1:4319/",
            "http://localhost:4317/",
            "https://127.0.0.1:4317/",
            "https://github.com/kibo",
            "about:blank",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "data:text/html,<p>x</p>",
        ] {
            assert!(!navigates(target, &allowed()), "{target} must be refused");
        }
        assert!(!navigates("http://127.0.0.1:4317/", &[]));
    }

    #[test]
    fn reads_the_sandbox_line() {
        assert_eq!(
            parse_sandbox("KIBO_SANDBOX http://127.0.0.1:4318"),
            Some("http://127.0.0.1:4318")
        );
        assert_eq!(parse_sandbox("KIBO_READY http://127.0.0.1:4317/"), None);
    }

    #[test]
    fn opener_scope_is_https_only() {
        let scope = serde_json::to_value(OpenUrlScope::https()).unwrap();
        assert_eq!(scope, serde_json::json!({ "url": "https://**" }));
    }

    #[test]
    fn plain_permissions_are_the_documented_set() {
        assert_eq!(
            PLAIN_PERMISSIONS,
            &[
                "updater:default",
                "process:allow-restart",
                "core:app:allow-version",
                "core:window:allow-set-title",
                "dialog:allow-open",
            ]
        );
    }

    #[test]
    fn dialog_permission_is_open_only() {
        let dialog: Vec<&&str> = PLAIN_PERMISSIONS
            .iter()
            .filter(|p| p.starts_with("dialog:"))
            .collect();
        assert_eq!(dialog, vec![&"dialog:allow-open"]);
    }

    #[test]
    fn reads_the_ready_line() {
        let url = parse_ready_line("KIBO_READY http://127.0.0.1:4317/?token=abc")
            .unwrap()
            .unwrap();
        assert_eq!(ipc_origin(&url), "http://127.0.0.1:4317");
        assert!(parse_ready_line("KIBO_SANDBOX http://127.0.0.1:4318").is_none());
    }

    #[test]
    fn an_invalid_ready_url_is_an_error_not_a_panic() {
        let error = parse_ready_line("KIBO_READY not a url")
            .unwrap()
            .unwrap_err();
        assert!(error.contains("not a url"), "{error}");
        assert!(parse_daemon_url("").is_err());
    }

    #[test]
    fn the_stop_message_tells_to_relaunch() {
        assert_eq!(
            stop_message("le démon a quitté (code 3)"),
            "Kibo s'est arrêté : le démon a quitté (code 3). Relance l'application."
        );
    }

    #[test]
    fn the_exit_message_gives_the_code_when_known() {
        assert_eq!(daemon_exit_message(Some(3)), "le démon a quitté (code 3)");
        assert_eq!(daemon_exit_message(None), "le démon a quitté");
    }

    #[test]
    fn window_is_never_smaller_than_the_layout() {
        assert_eq!(MIN_WINDOW, (960.0, 600.0));
    }
}
