use tauri_plugin_dialog::DialogExt;

/// Open a PDF via native file dialog. Returns { bytes, name } or null if cancelled.
#[tauri::command]
async fn open_pdf(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<tauri_plugin_dialog::FilePath>>();

    app.dialog()
        .file()
        .add_filter("PDF Files", &["pdf"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    // Wait on a dedicated blocking thread so we don't stall the async runtime
    let file_path = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .map_err(|e| e.to_string())?;

    match file_path {
        Some(fp) => {
            let path = fp
                .into_path()
                .map_err(|_| "Unsupported path type".to_string())?;
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("document.pdf")
                .to_string();
            let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&path))
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
            Ok(Some(serde_json::json!({ "bytes": bytes, "name": name })))
        }
        None => Ok(None),
    }
}

/// Save a PDF via native save dialog. Returns the saved path or null if cancelled.
#[tauri::command]
async fn save_pdf(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    default_name: String,
) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<tauri_plugin_dialog::FilePath>>();

    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PDF Files", &["pdf"])
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = tauri::async_runtime::spawn_blocking(move || rx.recv().ok().flatten())
        .await
        .map_err(|e| e.to_string())?;

    match file_path {
        Some(fp) => {
            let path = fp
                .into_path()
                .map_err(|_| "Unsupported path type".to_string())?;
            let path_str = path.to_string_lossy().to_string();
            tauri::async_runtime::spawn_blocking(move || std::fs::write(&path, &bytes))
                .await
                .map_err(|e| e.to_string())?
                .map_err(|e| e.to_string())?;
            Ok(Some(path_str))
        }
        None => Ok(None),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_pdf, save_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
