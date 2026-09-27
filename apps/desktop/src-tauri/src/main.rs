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
use tauri_plugin_window_state::{StateFlags, WindowExt};

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

fn daemon_capability(daemon_url: &Url) -> CapabilityBuilder {
    CapabilityBuilder::new("daemon")
        .window("main")
        .local(false)
        .remote(ipc_origin(daemon_url))
        .permission("updater:default")
        .permission("process:allow-restart")
        .permission("core:app:allow-version")
        .permission("core:window:allow-set-title")
        .permission_scoped(
            "opener:allow-open-url",
            vec![OpenUrlScope::https()],
            Vec::<OpenUrlScope>::new(),
        )
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
        );
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
                .env("KIBO_BUILTIN_DIR", builtin_dir.to_string_lossy().to_string())
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
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line = String::from_utf8_lossy(&line).trim().to_string();
                            if let Some(notice) = parse_notice(&line) {
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
                                    Err(e) => eprintln!(
                                        "[kibo] invalid notification from the daemon: {e}"
                                    ),
                                }
                                continue;
                            }
                            let Some(url) = line.strip_prefix("KIBO_READY ") else {
                                continue;
                            };
                            let url: Url = url.parse().expect("daemon printed an invalid url");
                            handle
                                .add_capability(daemon_capability(&url))
                                .expect("cannot grant the daemon origin its capability");
                            let window = WebviewWindowBuilder::new(
                                &handle,
                                "main",
                                WebviewUrl::External(url),
                            )
                            .title("Kibo")
                            .inner_size(1440.0, 900.0)
                            .min_inner_size(MIN_WINDOW.0, MIN_WINDOW.1)
                            .build()
                            .expect("cannot open the main window");
                            if let Err(e) = window.restore_state(WINDOW_STATE) {
                                eprintln!("[kibo] window state not restored: {e}");
                            }
                            if std::env::var("KIBO_SMOKE").is_ok() {
                                handle.exit(0);
                            }
                        }
                        CommandEvent::Terminated(_) if take_daemon(&handle).is_some() => {
                            std::process::exit(1);
                        }
                        _ => {}
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
        let url: Url = "http://127.0.0.1:4317/?token=abc#/settings".parse().unwrap();
        assert_eq!(ipc_origin(&url), "http://127.0.0.1:4317");
    }

    #[test]
    fn opener_scope_is_https_only() {
        let scope = serde_json::to_value(OpenUrlScope::https()).unwrap();
        assert_eq!(scope, serde_json::json!({ "url": "https://**" }));
    }

    #[test]
    fn window_is_never_smaller_than_the_layout() {
        assert_eq!(MIN_WINDOW, (960.0, 600.0));
    }
}
