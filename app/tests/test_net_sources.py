from app import net
from app.config import settings
from app.core import sources


def _with_mode(mode: str, url: str = ""):
    old = (settings.http_proxy_mode, settings.http_proxy_url)
    settings.http_proxy_mode = mode
    settings.http_proxy_url = url
    return old


def _restore(old):
    settings.http_proxy_mode, settings.http_proxy_url = old


def test_proxy_mode_direct_ignores_env() -> None:
    old = _with_mode("direct")
    try:
        assert net.trust_env() is False
        assert net.proxy_url() is None
        assert net.websocket_proxy() is None
        assert net.effective_proxy_for_log() == "direct"
    finally:
        _restore(old)


def test_proxy_mode_url_redacts_credentials() -> None:
    old = _with_mode("url", "http://user:secret@proxy.local:7897")
    try:
        assert net.proxy_url() == "http://user:secret@proxy.local:7897"
        assert net.websocket_proxy() == "http://user:secret@proxy.local:7897"
        shown = net.effective_proxy_for_log()
        assert "secret" not in shown and "proxy.local:7897" in shown
    finally:
        _restore(old)


def test_proxy_mode_env_default_and_invalid_falls_back() -> None:
    old = _with_mode("bogus")
    try:
        assert net.proxy_mode() == "env"
        assert net.trust_env() is True
        assert net.websocket_proxy() is True
    finally:
        _restore(old)


def test_sources_registry_covers_all_collectors_and_emsc() -> None:
    names = {s.name for s in sources.all_sources()}
    assert {"usgs", "emsc", "gdacs", "eonet", "gdelt", "war",
            "openmeteo", "cma", "cenc", "firms"} == names
    emsc = sources.by_name()["emsc"]
    assert emsc.kind == "ws"
    # stale 至少 10 分钟；openmeteo 6 小时一轮不能按 1 小时判异常
    assert sources.stale_seconds(sources.by_name()["usgs"]) >= 600
    assert sources.stale_seconds(sources.by_name()["openmeteo"]) >= 6 * 3600


def test_firms_disabled_without_key() -> None:
    old = (settings.enable_firms, settings.firms_map_key)
    settings.enable_firms = True
    settings.firms_map_key = ""
    try:
        assert sources.by_name()["firms"].enabled is False
        settings.firms_map_key = "abc"
        assert sources.by_name()["firms"].enabled is True
    finally:
        settings.enable_firms, settings.firms_map_key = old


def test_pipeline_status_thresholds() -> None:
    ps = sources.pipeline_status
    assert ps(9, 0, 2) == "ok"
    assert ps(9, 1, 2) == "ok"
    assert ps(9, 2, 2) == "degraded"
    assert ps(9, 9, 2) == "down"
    assert ps(0, 0, 2) == "down"
    assert ps(3, 1, 1) == "degraded"
