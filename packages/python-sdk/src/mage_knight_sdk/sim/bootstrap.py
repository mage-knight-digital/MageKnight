from __future__ import annotations

import http.client
import json
from dataclasses import dataclass
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse


@dataclass(frozen=True)
class BootstrapSession:
    game_id: str
    player_id: str
    session_token: str


class BootstrapError(RuntimeError):
    pass


def create_game(api_base_url: str, player_count: int, seed: int | None = None) -> BootstrapSession:
    payload: dict[str, Any] = {"playerCount": player_count}
    if seed is not None:
        payload["seed"] = seed
    data = _post_json(f"{api_base_url.rstrip('/')}/games", payload)
    return _parse_session(data)


def join_game(api_base_url: str, game_id: str, session_token: str | None = None) -> BootstrapSession:
    payload: dict[str, Any] = {}
    if session_token is not None:
        payload["sessionToken"] = session_token
    data = _post_json(f"{api_base_url.rstrip('/')}/games/{game_id}/join", payload)
    return _parse_session(data)


class BootstrapClient:
    """Persistent-connection HTTP client for bootstrap API calls.

    Reuses a single TCP connection across multiple create/join calls,
    avoiding per-request connection overhead.
    """

    def __init__(self, base_url: str) -> None:
        parsed = urlparse(base_url.rstrip("/"))
        self._base_path = parsed.path or ""
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if parsed.scheme == "https":
            self._conn: http.client.HTTPConnection = http.client.HTTPSConnection(
                host, port, timeout=10,
            )
        else:
            self._conn = http.client.HTTPConnection(host, port, timeout=10)

    def create_game(self, player_count: int, seed: int | None = None) -> BootstrapSession:
        payload: dict[str, Any] = {"playerCount": player_count}
        if seed is not None:
            payload["seed"] = seed
        data = self._post(f"{self._base_path}/games", payload)
        return _parse_session(data)

    def join_game(self, game_id: str, session_token: str | None = None) -> BootstrapSession:
        payload: dict[str, Any] = {}
        if session_token is not None:
            payload["sessionToken"] = session_token
        data = self._post(f"{self._base_path}/games/{game_id}/join", payload)
        return _parse_session(data)

    def close(self) -> None:
        self._conn.close()

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        try:
            self._conn.request("POST", path, body=body, headers=headers)
            resp = self._conn.getresponse()
        except (OSError, http.client.HTTPException) as error:
            raise BootstrapError(f"Bootstrap API request failed: {error}") from error

        raw = resp.read().decode("utf-8")
        if resp.status >= 400:
            raise BootstrapError(f"Bootstrap API returned {resp.status}: {raw}")

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as error:
            raise BootstrapError(f"Bootstrap API returned invalid JSON: {error}") from error

        if not isinstance(data, dict):
            raise BootstrapError("Bootstrap API response must be a JSON object")
        return data


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    encoded = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=encoded,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )

    try:
        with request.urlopen(req, timeout=10) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise BootstrapError(f"Bootstrap API returned {error.code}: {body}") from error
    except URLError as error:
        raise BootstrapError(f"Bootstrap API request failed: {error}") from error
    except json.JSONDecodeError as error:
        raise BootstrapError(f"Bootstrap API returned invalid JSON: {error}") from error

    if not isinstance(data, dict):
        raise BootstrapError("Bootstrap API response must be a JSON object")
    return data


def _parse_session(payload: dict[str, Any]) -> BootstrapSession:
    game_id = payload.get("gameId")
    player_id = payload.get("playerId")
    session_token = payload.get("sessionToken")

    if not isinstance(game_id, str) or not game_id:
        raise BootstrapError("Bootstrap response is missing a valid gameId")
    if not isinstance(player_id, str) or not player_id:
        raise BootstrapError("Bootstrap response is missing a valid playerId")
    if not isinstance(session_token, str) or not session_token:
        raise BootstrapError("Bootstrap response is missing a valid sessionToken")

    return BootstrapSession(game_id=game_id, player_id=player_id, session_token=session_token)
