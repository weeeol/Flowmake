from sqlalchemy import Column, Integer, String, Text
from app.database import Base

class DbCodeSnippet(Base):
    __tablename__ = "snippets"

    id = Column(String, primary_key=True, index=True)
    code = Column(Text, nullable=False)
