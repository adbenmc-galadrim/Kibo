#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

struct Daemon(Mutex<Option<CommandChild>>);

fn take_daemon(app: &AppHandle) -> Option<CommandChild> {
    app.state::<Daemon>().0.lock().expect("daemon lock").take()
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let ui_dir = app.path().resource_dir()?.join("ui");
            let (mut events, child) = app
                .shell()
                .sidecar("kibo-daemon")?
                .args(["--port", "0", "--ui", &ui_dir.to_string_lossy()])
                .spawn()?;
            app.manage(Daemon(Mutex::new(Some(child))));
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = events.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let line = String::from_utf8_lossy(&line).trim().to_string();
                            let Some(url) = line.strip_prefix("KIBO_READY ") else {
                                continue;
                            };
                            let url = url.parse().expect("daemon printed an invalid url");
                            WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url))
                                .title("Kibo")
                                .inner_size(1440.0, 900.0)
                                .build()
                                .expect("cannot open the main window");
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
