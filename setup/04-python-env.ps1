# D:\crisis\setup\04-python-env.ps1

$env:PYTHONUTF8 = '1'
Set-Location 'D:\crisis\app'

# 本机已装 Python 3.13.15 与 uv 0.12.3,优先用 uv(快一个数量级)
uv venv --python 3.13 .venv
.\.venv\Scripts\Activate.ps1
uv pip install -r requirements.txt

# 验证关键包与编码状态
python -c "import sys,locale; print('utf8_mode=',sys.flags.utf8_mode); print('preferred=',locale.getpreferredencoding(False))"
python -c "import psycopg, shapely, apscheduler; print('deps ok')"
python -c "from zoneinfo import ZoneInfo; print(ZoneInfo('Asia/Shanghai'))"
