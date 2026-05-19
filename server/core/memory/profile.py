"""
User profile management.
"""
from typing import Dict, Any, Optional

_profiles: Dict[str, Dict[str, Any]] = {}


def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    return _profiles.get(user_id)


def create_profile(user_id: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    profile = {"user_id": user_id, "preferences": {}, "domain_profiles": {}}
    if data:
        profile.update(data)
    _profiles[user_id] = profile
    return profile


def update_profile(user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    profile = _profiles.get(user_id)
    if not profile:
        return None
    profile.update(data)
    return profile


def update_domain_profile(user_id: str, domain: str, domain_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    profile = _profiles.get(user_id)
    if not profile:
        return None
    profile["domain_profiles"][domain] = domain_data
    return profile


def get_domain_profile(user_id: str, domain: str) -> Optional[Dict[str, Any]]:
    profile = _profiles.get(user_id)
    if not profile:
        return None
    return profile.get("domain_profiles", {}).get(domain)