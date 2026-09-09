from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# app/app/config.py → 仓库根
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    log_dir: Path | None = None
    log_level: str = "INFO"
    log_max_bytes: int = 500 * 1024 * 1024

    enable_usgs: bool = True
    enable_gdacs: bool = True
    enable_emsc: bool = True
    enable_eonet: bool = True
    enable_gdelt: bool = True
    enable_openmeteo: bool = True
    enable_cma: bool = True
    enable_cenc: bool = True
    enable_firms: bool = False
    firms_map_key: str = ""
    firms_source: str = "VIIRS_SNPP_NRT"

    interval_usgs: int = 120
    interval_gdacs: int = 360
    interval_eonet: int = 900
    interval_gdelt: int = 900
    interval_openmeteo: int = 21600
    interval_cma: int = 300
    interval_cenc: int = 180
    interval_firms: int = 900

    alert_eq_global_mag: float = 5.0
    alert_eq_local_mag: float = 4.0
    alert_mute_minutes: int = 30
    alert_conflict_min_confidence: float = 0.7
    # 聚合冲突信号（国家×日）当日累计 ≥ N 起才告警
    alert_conflict_min_events: int = 10
    # 启动后多少秒才开始评估告警（让回补/首采先落库）
    alert_startup_grace_seconds: int = 120

    # 出站代理策略：env | direct | url（见 app/net.py）
    http_proxy_mode: str = "env"
    http_proxy_url: str = ""
    # 管道判定：≥ N 个已启用源同时异常 → degraded；全部异常 → down
    pipeline_degraded_min_sources: int = 2


settings = Settings()
if not settings.log_dir or str(settings.log_dir).strip() in ("", "."):
    settings.log_dir = REPO_ROOT / "logs"
