package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkUpsertRequest;
import com.sistema.dnd.sistema.entity.LandmarkType;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class LandmarkMapValidator {

    public static final String DUNGEON_MAP_ERROR_MESSAGE = "Las mazmorras solo permiten imagenes o JSON con type=\"mazmorra\".";

    private final MediaAssetRepository mediaAssetRepository;
    private final ObjectMapper objectMapper;

    public LandmarkMapValidator(MediaAssetRepository mediaAssetRepository, ObjectMapper objectMapper) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.objectMapper = objectMapper;
    }

    public MediaAssetEntity resolveValidatedMapAsset(LandmarkUpsertRequest request) {
        MediaAssetEntity mapAsset = null;
        Long mapAssetId = request.mapAssetId();
        if (mapAssetId != null && mapAssetId > 0) {
            mapAsset = resolveMapAsset(mapAssetId);
        }

        validate(request.tipo(), request.mapa(), mapAsset);
        return mapAsset;
    }

    private void validate(LandmarkType landmarkType, LandmarkMapRequest map, MediaAssetEntity mapAsset) {
        if (landmarkType != LandmarkType.mazmorra) {
            return;
        }

        if (map != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, DUNGEON_MAP_ERROR_MESSAGE);
        }

        if (mapAsset == null) {
            return;
        }

        if (mapAsset.getKind() == MediaAssetKind.image) {
            return;
        }

        if (mapAsset.getKind() != MediaAssetKind.json || !isDungeonJsonAsset(mapAsset)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, DUNGEON_MAP_ERROR_MESSAGE);
        }
    }

    private boolean isDungeonJsonAsset(MediaAssetEntity asset) {
        String textContent = asset.getTextContent();
        if (textContent == null || textContent.isBlank()) {
            return false;
        }

        try {
            JsonNode root = objectMapper.readTree(textContent);
            return root.isObject() && "mazmorra".equals(root.path("type").asText(null));
        } catch (IOException ex) {
            return false;
        }
    }

    private MediaAssetEntity resolveMapAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image && asset.getKind() != MediaAssetKind.json) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId debe apuntar a un asset de imagen o json");
        }
        return asset;
    }
}
