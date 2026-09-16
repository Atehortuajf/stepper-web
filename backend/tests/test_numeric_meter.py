"""The public API accepts numeric meters; category labels are metadata only."""
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
import torch
from pydantic import ValidationError
from backend.app.schemas.generate import GenerateRequest
from backend.app.core.model_loader import ModelService

@pytest.mark.parametrize('meter', [None, 0, -1, 1.5, '8', True])
def test_rejects_missing_or_ambiguous_meter(meter):
    with pytest.raises(ValidationError):
        GenerateRequest(meter=meter)


def test_neural_service_preserves_meter_for_each_category():
    service = ModelService()
    service.model = Mock()
    service.model.generate.return_value = SimpleNamespace(notes=[])
    service.is_loaded = True
    service.device = torch.device('cpu')
    for category in ['Medium', 'Hard', 'Challenge']:
        service.generate(torch.zeros(2, 1, 48, 128), meter=8, category=category)
        assert service.model.generate.call_args.kwargs['meter'] == 8


def test_api_category_is_only_metadata(client):
    outputs = []
    for category in ['Medium', 'Hard', 'Challenge']:
        response = client.post('/api/generate', json={'meter': 8, 'category': category, 'force_fallback': True})
        assert response.status_code == 200
        result = response.json()
        assert result['meter'] == 8 and result['category'] == category
        outputs.append(result['placements'])
    assert outputs[0] == outputs[1] == outputs[2]


def test_api_rejects_legacy_category_only_request(client):
    response = client.post('/api/generate', json={'difficulty': 3, 'force_fallback': True})
    assert response.status_code == 422
