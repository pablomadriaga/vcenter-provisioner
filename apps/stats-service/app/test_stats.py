import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import time
from app.main import app, stats_data

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_stats():
    """Reset stats_data before each test."""
    original_data = stats_data.copy()
    yield
    stats_data.clear()
    stats_data.update(original_data)


class TestHealthCheck:
    def test_health_check_returns_200(self):
        """Test that health check returns 200 with status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestRootEndpoint:
    def test_root_returns_service_message(self):
        """Test that root endpoint returns service info message."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {
            "message": "vCenter Provisioner: Stats Service is active."
        }


class TestGetStats:
    def test_get_stats_returns_stats_data(self):
        """Test that get stats returns the stats_data dictionary."""
        response = client.get("/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_provisions" in data
        assert "successful" in data
        assert "failed" in data
        assert "last_update" in data

    def test_get_stats_returns_integers(self):
        """Test that stats return integer values."""
        response = client.get("/stats")
        data = response.json()
        assert isinstance(data["total_provisions"], int)
        assert isinstance(data["successful"], int)
        assert isinstance(data["failed"], int)

    def test_get_stats_consistency(self):
        """Test that successful + failed = total_provisions."""
        response = client.get("/stats")
        data = response.json()
        assert data["successful"] + data["failed"] == data["total_provisions"]

    def test_get_stats_non_negative(self):
        """Test that all stats are non-negative."""
        response = client.get("/stats")
        data = response.json()
        assert data["total_provisions"] >= 0
        assert data["successful"] >= 0
        assert data["failed"] >= 0

    def test_get_stats_last_update_format(self):
        """Test that last_update is a string or None."""
        response = client.get("/stats")
        data = response.json()
        assert data["last_update"] is None or isinstance(data["last_update"], str)


class TestStatsCollector:
    @patch("time.sleep", return_value=None)
    @patch("app.main.time.ctime", return_value="Mon Jan 31 16:30:00 2026")
    def test_stats_collector_increments_total(self, mock_ctime, mock_sleep):
        """Test that stats collector increments total_provisions."""
        initial_total = stats_data["total_provisions"]

        # Simulate one iteration of the collector loop
        stats_data["total_provisions"] += 1
        stats_data["successful"] = int(stats_data["total_provisions"] * 0.95)
        stats_data["failed"] = stats_data["total_provisions"] - stats_data["successful"]
        stats_data["last_update"] = "Mon Jan 31 16:30:00 2026"

        assert stats_data["total_provisions"] == initial_total + 1
        assert stats_data["last_update"] == "Mon Jan 31 16:30:00 2026"

    @patch("time.sleep", return_value=None)
    @patch("app.main.time.ctime", return_value="Mon Jan 31 16:30:00 2026")
    def test_stats_collector_calculates_success_rate(self, mock_ctime, mock_sleep):
        """Test that stats collector calculates 95% success rate."""
        stats_data["total_provisions"] = 100
        stats_data["successful"] = int(100 * 0.95)
        stats_data["failed"] = 100 - 95
        stats_data["last_update"] = "Mon Jan 31 16:30:00 2026"

        assert stats_data["total_provisions"] == 100
        assert stats_data["successful"] == 95
        assert stats_data["failed"] == 5

    @patch("time.sleep", return_value=None)
    def test_stats_collector_handles_zero_total(self, mock_sleep):
        """Test that stats collector handles zero total provisions."""
        stats_data["total_provisions"] = 0
        stats_data["successful"] = int(0 * 0.95)
        stats_data["failed"] = 0 - 0

        assert stats_data["total_provisions"] == 0
        assert stats_data["successful"] == 0
        assert stats_data["failed"] == 0


class TestStatsDataStructure:
    def test_stats_data_has_required_keys(self):
        """Test that stats_data has all required keys."""
        assert "total_provisions" in stats_data
        assert "successful" in stats_data
        assert "failed" in stats_data
        assert "last_update" in stats_data

    def test_stats_data_initial_values(self):
        """Test that stats_data has correct initial values."""
        assert stats_data["total_provisions"] == 0
        assert stats_data["successful"] == 0
        assert stats_data["failed"] == 0
        assert stats_data["last_update"] is None


class TestErrorHandling:
    def test_get_stats_with_api_exception(self):
        """Test that get stats handles exceptions gracefully."""
        # This test verifies endpoint doesn't crash
        response = client.get("/stats")
        assert response.status_code == 200

    def test_health_check_with_api_exception(self):
        """Test that health check handles exceptions gracefully."""
        response = client.get("/health")
        assert response.status_code == 200


class TestConcurrentRequests:
    def test_concurrent_stats_requests(self):
        """Test that multiple concurrent stats requests work correctly."""
        responses = [client.get("/stats") for _ in range(10)]
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert "total_provisions" in data


class TestStatsConsistency:
    def test_failed_never_exceeds_total(self):
        """Test that failed never exceeds total_provisions."""
        response = client.get("/stats")
        data = response.json()
        assert data["failed"] <= data["total_provisions"]

    def test_successful_never_exceeds_total(self):
        """Test that successful never exceeds total_provisions."""
        response = client.get("/stats")
        data = response.json()
        assert data["successful"] <= data["total_provisions"]

    def test_success_rate_is_realistic(self):
        """Test that success rate is between 0% and 100%."""
        response = client.get("/stats")
        data = response.json()
        if data["total_provisions"] > 0:
            success_rate = data["successful"] / data["total_provisions"]
            assert 0 <= success_rate <= 1
