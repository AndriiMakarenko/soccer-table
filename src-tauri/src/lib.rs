pub mod commands;
pub mod database;
pub mod repository;

use tauri::Manager;

pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let database = database::Database::open_in_app_data(app.handle())?;
            app.manage(database);
            Ok(())
        });

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            commands::load_app_state,
            commands::persist_app_state,
            commands::delete_league,
            commands::delete_season,
            commands::regenerate_fixtures,
            commands::update_round_results,
            commands::reset_results,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
