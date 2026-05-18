"""
Domain configuration manager for Lingxi backend.
Loads domain configs from YAML files.
"""
import os
from typing import Optional, Dict, Any, List

import yaml

from core.config import settings


class DomainManager:
    """Manages domain configurations loaded from YAML files."""

    def __init__(self):
        self._configs: Dict[str, Dict[str, Any]] = {}
        self.current_domain_id: str = settings.default_domain
        self._load_all()

    def _load_all(self):
        """Load all domain YAML files from the domains directory."""
        domains_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "domains")
        if not os.path.isdir(domains_dir):
            return

        for root, dirs, files in os.walk(domains_dir):
            for filename in files:
                if filename.endswith((".yaml", ".yml")):
                    filepath = os.path.join(root, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            config = yaml.safe_load(f)
                        if config and "id" in config:
                            domain_id = config["id"]
                            self._configs[domain_id] = self._normalize_config(config)
                    except Exception as e:
                        print(f"  Failed to load domain config {filename}: {e}")

    def _normalize_config(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize YAML config to match the JSON config structure."""
        domain_id = raw.get("id", "unknown")
        return {
            "domain": {
                "id": domain_id,
                "name": raw.get("name", domain_id),
                "display_name": raw.get("display_name", raw.get("name", domain_id)),
                "icon": raw.get("icon", "🤖"),
                "description": raw.get("description", ""),
            },
            "intents": raw.get("intents", []),
            "tools": raw.get("tools", []),
            "safety": raw.get("safety", {}),
            "prompts": raw.get("prompts", {}),
            "retrieval": raw.get("retrieval", {}),
            "welcome": raw.get("welcome", {}),
        }

    def get_domain_config(self, domain_id: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a specific domain."""
        return self._configs.get(domain_id)

    def get_all_domains(self) -> List[Dict[str, Any]]:
        """Get list of all domain summaries."""
        return [
            {
                "id": config["domain"]["id"],
                "name": config["domain"]["name"],
                "display_name": config["domain"]["display_name"],
                "icon": config["domain"]["icon"],
                "description": config["domain"]["description"],
            }
            for config in self._configs.values()
        ]

    def switch_domain(self, domain_id: str) -> bool:
        """Switch the current active domain."""
        if domain_id in self._configs:
            self.current_domain_id = domain_id
            return True
        return False

    @property
    def current_config(self) -> Optional[Dict[str, Any]]:
        """Get the current active domain configuration."""
        return self.get_domain_config(self.current_domain_id)


# Global instance
domain_manager = DomainManager()