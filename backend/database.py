"""MongoDB connection and collection helpers for OutbreakLens."""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGODB_URI)
db = client["outbreaklens"]


def get_reports():
    """Return the reports collection."""
    return db["reports"]


def get_community_risks():
    """Return the community_risks collection."""
    return db["community_risks"]


def get_external_data():
    """Return the external_data collection."""
    return db["external_data"]


async def ping() -> bool:
    """Verify MongoDB connectivity."""
    try:
        await client.admin.command("ping")
        return True
    except Exception:
        return False


async def ensure_indexes():
    """Create useful indexes; safe to call repeatedly (idempotent)."""
    reports = get_reports()
    await reports.create_index([("demographics.county", 1)])
    await reports.create_index([("created_at", -1)])
    await reports.create_index([("report_id", 1)], unique=True)

    community = get_community_risks()
    await community.create_index([("county", 1), ("date", -1)])

    external = get_external_data()
    await external.create_index([("source", 1), ("data_type", 1)])
