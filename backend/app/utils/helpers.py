from flask import request, jsonify
from functools import wraps
import uuid


def api_response(data=None, message=None, status=200):
    """Standardized API response envelope."""
    body = {"success": True}
    if data is not None:
        body["data"] = data
    if message:
        body["message"] = message
    return jsonify(body), status


def api_error(message, status=400, errors=None):
    """Standardized API error response."""
    body = {"success": False, "error": message}
    if errors:
        body["errors"] = errors
    return jsonify(body), status


def is_valid_uuid(val):
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False


def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr


def get_user_agent():
    return request.headers.get('User-Agent', '')
