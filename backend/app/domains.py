"""Domains API - Domain management"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from core.domain.manager import domain_manager

router = APIRouter()


class SwitchDomainRequest(BaseModel):
    domain: str


@router.get("/domains")
async def list_domains():
    domains = domain_manager.get_all_domains()
    return {
        "domains": domains,
        "default": domain_manager.current_domain_id,
        "status": "developing",
    }


@router.post("/domains")
async def switch_domain(request: SwitchDomainRequest):
    if not request.domain:
        raise HTTPException(status_code=400, detail="请指定领域")

    success = domain_manager.switch_domain(request.domain)
    if not success:
        raise HTTPException(status_code=404, detail="领域不存在")

    config = domain_manager.get_domain_config(request.domain)
    return {
        "success": True,
        "current_domain": request.domain,
        "domain_info": {
            "id": config["domain"]["id"],
            "name": config["domain"]["name"],
            "display_name": config["domain"]["display_name"],
            "icon": config["domain"]["icon"],
        },
    }


@router.get("/domains/{domain_id}")
async def get_domain(domain_id: str):
    config = domain_manager.get_domain_config(domain_id)
    if not config:
        raise HTTPException(status_code=404, detail="领域不存在")
    return config