"""Vendored Aesthetics Predictor v2 (LAION) modeling code.

Derived from shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE
(configuration_predictor.py + modeling_v2.py). Vendored to remove the
trust_remote_code dependency at load time.

Source: https://huggingface.co/shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE
License: Apache-2.0 (shunk031)
"""
from __future__ import annotations

from typing import Optional, Union

import torch
import torch.nn as nn
from transformers import CLIPVisionModelWithProjection
from transformers.modeling_outputs import ImageClassifierOutputWithNoAttention
from transformers.models.clip.configuration_clip import CLIPVisionConfig


class AestheticsPredictorConfig(CLIPVisionConfig):
    model_type = "aesthetics_predictor"


class AestheticsPredictorV2Linear(CLIPVisionModelWithProjection):
    """CLIP ViT-L/14 vision encoder + projection + MLP aesthetic head.

    Outputs a scalar AVA-scale score (~1-10) per image via `logits`.
    """

    def __init__(self, config: AestheticsPredictorConfig) -> None:
        super().__init__(config)
        self.layers = nn.Sequential(
            nn.Linear(config.projection_dim, 1024),
            nn.Dropout(0.2),
            nn.Linear(1024, 128),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.Dropout(0.1),
            nn.Linear(64, 16),
            nn.Linear(16, 1),
        )
        self.post_init()

    def forward(
        self,
        pixel_values: Optional[torch.FloatTensor] = None,
        output_attentions: Optional[bool] = None,
        output_hidden_states: Optional[bool] = None,
        labels: Optional[torch.Tensor] = None,
        return_dict: Optional[bool] = None,
    ) -> Union[tuple, ImageClassifierOutputWithNoAttention]:
        return_dict = (
            return_dict if return_dict is not None else self.config.use_return_dict
        )
        outputs = super().forward(
            pixel_values=pixel_values,
            output_attentions=output_attentions,
            output_hidden_states=output_hidden_states,
            return_dict=return_dict,
        )
        image_embeds = outputs[0]
        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        prediction = self.layers(image_embeds)
        loss = None
        if labels is not None:
            loss_fct = nn.MSELoss()
            loss = loss_fct(prediction.squeeze(-1), labels.float())
        if not return_dict:
            return (loss, prediction, image_embeds)
        return ImageClassifierOutputWithNoAttention(
            loss=loss,
            logits=prediction,
            hidden_states=image_embeds,
        )
