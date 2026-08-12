# D:\crisis\app\app\core\models.py
# 本项目入库主路径使用 SQLAlchemy text() + 原生 SQL(规格第 08 章)。
# 本文件保留为 ORM 占位,供扩展/测试引用表名,不参与运行时主路径。
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
