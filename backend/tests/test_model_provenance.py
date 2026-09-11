"""Generation must not hide missing weights, failed inference, or empty predictions."""
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
import torch
from backend.app.core.model_loader import ModelService


def service_with_model(notes=(), model_type='genuine'):
    service = ModelService()
    service.device = torch.device('cpu')
    service.model = Mock()
    service.model.generate.return_value = SimpleNamespace(notes=notes)
    service.model_type = model_type
    service.is_loaded = True
    service.fallback_generator = Mock()
    return service


def test_explicit_missing_checkpoint_leaves_neural_unavailable(tmp_path):
    service = ModelService()
    assert service.initialize(weights_path=tmp_path / 'missing.pt', force_device='cpu') is False
    assert service.model is None
    assert service.get_status()['model_loaded'] is False
    assert service.get_status()['status'] == 'degraded'
    with pytest.raises(RuntimeError, match='unavailable'):
        service.generate(torch.zeros(2, 4, 48, 128), difficulty=2)


def test_empty_neural_prediction_stays_empty():
    service = service_with_model()
    notes, source = service.generate(torch.zeros(2, 4, 48, 128), difficulty=2)
    assert notes == []
    assert source == 'neural'
    service.fallback_generator.generate.assert_not_called()


def test_neural_failure_is_not_a_successful_fallback():
    service = service_with_model()
    service.model.generate.side_effect = ValueError('bad model shape')
    with pytest.raises(RuntimeError, match='no rule-based notes'):
        service.generate(torch.zeros(2, 4, 48, 128), difficulty=2)
    service.fallback_generator.generate.assert_not_called()


def test_synthetic_checkpoint_is_labelled():
    service = service_with_model([(0, '1000')], model_type='synthetic')
    notes, source = service.generate(torch.zeros(2, 4, 48, 128), difficulty=2)
    assert notes[0]['arrows'] == '1000'
    assert source == 'synthetic'


def test_rule_based_mode_requires_explicit_request():
    service = service_with_model()
    service.fallback_generator.generate.return_value = []
    notes, source = service.generate(torch.zeros(2, 4, 48, 128), difficulty=2, force_fallback=True)
    assert notes == [] and source == 'fallback'
    service.model.generate.assert_not_called()
    service.fallback_generator.generate.assert_called_once()
