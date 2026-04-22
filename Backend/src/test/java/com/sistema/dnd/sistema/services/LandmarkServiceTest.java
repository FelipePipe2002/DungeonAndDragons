package com.sistema.dnd.sistema.services;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkUpsertRequest;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.LandmarkMapSource;
import com.sistema.dnd.sistema.entity.LandmarkType;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.repository.EstadoRepository;
import com.sistema.dnd.sistema.repository.LandmarkEventRepository;
import com.sistema.dnd.sistema.repository.LandmarkMapRefRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import com.sistema.dnd.sistema.repository.SubdivisionRepository;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class LandmarkServiceTest {

    @Mock
    private LandmarkRepository landmarkRepository;

    @Mock
    private LandmarkEventRepository landmarkEventRepository;

    @Mock
    private LandmarkMapRefRepository landmarkMapRefRepository;

    @Mock
    private EstadoRepository estadoRepository;

    @Mock
    private SubdivisionRepository subdivisionRepository;

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private TaggingService taggingService;

    @Mock
    private DomainMapper domainMapper;

    private LandmarkService landmarkService;

    @BeforeEach
    void setUp() {
        LandmarkMapValidator landmarkMapValidator = new LandmarkMapValidator(mediaAssetRepository, new ObjectMapper());
        landmarkService = new LandmarkService(
            landmarkRepository,
            landmarkEventRepository,
            landmarkMapRefRepository,
            estadoRepository,
            subdivisionRepository,
            taggingService,
            domainMapper,
            landmarkMapValidator
        );

        when(landmarkRepository.save(any(LandmarkEntity.class))).thenAnswer(invocation -> {
            LandmarkEntity landmark = invocation.getArgument(0);
            if (landmark.getId() == null) {
                landmark.setId(1L);
            }
            return landmark;
        });
        when(domainMapper.toLandmarkDto(any(LandmarkEntity.class), anyBoolean(), anyBoolean(), anyBoolean()))
            .thenAnswer(invocation -> {
                LandmarkEntity landmark = invocation.getArgument(0);
                return new LandmarkDto(
                    landmark.getId(),
                    landmark.getIcono(),
                    landmark.getNombre(),
                    landmark.getTipo().name(),
                    landmark.getEstado() != null ? landmark.getEstado().getId() : null,
                    landmark.getSubdivision() != null ? landmark.getSubdivision().getId() : null,
                    landmark.getEscalaIcono(),
                    landmark.getEscalaTexto(),
                    landmark.getMostrarLeyenda(),
                    List.of(landmark.getPosicionX(), landmark.getPosicionY()),
                    List.of(),
                    landmark.getPoblacion(),
                    landmark.getDescripcionCorta(),
                    landmark.getHistoria(),
                    List.of(),
                    landmark.getMapAsset() == null ? null : landmark.getMapAsset().getId(),
                    landmark.getMapAsset() == null ? null : landmark.getMapAsset().getKind().name(),
                    landmark.getMapRotationDegrees(),
                    landmark.getMapGridEnabled(),
                    landmark.getMapGridCellSize(),
                    landmark.getMapGridOffsetX(),
                    landmark.getMapGridOffsetY(),
                    landmark.getOrganizationMapLinks(),
                    landmark.getHiddenMapBuildings(),
                    null,
                    List.of(),
                    List.of(),
                    List.of()
                );
            });
    }

    @Test
    void createAllowsDungeonWithImageAsset() {
        MediaAssetEntity imageAsset = mediaAsset(10L, MediaAssetKind.image, null);
        when(mediaAssetRepository.findById(10L)).thenReturn(Optional.of(imageAsset));

        LandmarkDto result = assertDoesNotThrow(() -> landmarkService.create(baseRequest(LandmarkType.mazmorra, null, 10L)));

        assertEquals(10L, result.mapAssetId());
        verify(landmarkMapRefRepository, never()).save(any());
    }

    @Test
    void createAllowsDungeonWithValidJsonAsset() {
        MediaAssetEntity jsonAsset = mediaAsset(11L, MediaAssetKind.json, "{\"type\":\"mazmorra\",\"version\":1}");
        when(mediaAssetRepository.findById(11L)).thenReturn(Optional.of(jsonAsset));

        LandmarkDto result = assertDoesNotThrow(() -> landmarkService.create(baseRequest(LandmarkType.mazmorra, null, 11L)));

        assertEquals(11L, result.mapAssetId());
        assertEquals("json", result.mapAssetKind());
    }

    @Test
    void createRejectsDungeonWithJsonAssetWithoutType() {
        MediaAssetEntity jsonAsset = mediaAsset(12L, MediaAssetKind.json, "{\"version\":1}");
        when(mediaAssetRepository.findById(12L)).thenReturn(Optional.of(jsonAsset));

        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> landmarkService.create(baseRequest(LandmarkType.mazmorra, null, 12L))
        );

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        assertEquals(LandmarkMapValidator.DUNGEON_MAP_ERROR_MESSAGE, thrown.getReason());
        verify(landmarkRepository, never()).save(any(LandmarkEntity.class));
    }

    @Test
    void createRejectsDungeonWithJsonAssetWithWrongType() {
        MediaAssetEntity jsonAsset = mediaAsset(13L, MediaAssetKind.json, "{\"type\":\"ciudad\",\"version\":1}");
        when(mediaAssetRepository.findById(13L)).thenReturn(Optional.of(jsonAsset));

        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> landmarkService.create(baseRequest(LandmarkType.mazmorra, null, 13L))
        );

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        assertEquals(LandmarkMapValidator.DUNGEON_MAP_ERROR_MESSAGE, thrown.getReason());
        verify(landmarkRepository, never()).save(any(LandmarkEntity.class));
    }

    @ParameterizedTest
    @MethodSource("dungeonMapReferences")
    void createRejectsDungeonWithMapReference(LandmarkMapRequest mapRequest) {
        ResponseStatusException thrown = assertThrows(
            ResponseStatusException.class,
            () -> landmarkService.create(baseRequest(LandmarkType.mazmorra, mapRequest, null))
        );

        assertEquals(HttpStatus.BAD_REQUEST, thrown.getStatusCode());
        assertEquals(LandmarkMapValidator.DUNGEON_MAP_ERROR_MESSAGE, thrown.getReason());
        verify(landmarkRepository, never()).save(any(LandmarkEntity.class));
    }

    @Test
    void createKeepsAllowingCityWithJsonAsset() {
        MediaAssetEntity jsonAsset = mediaAsset(14L, MediaAssetKind.json, "{\"type\":\"ciudad\"}");
        when(mediaAssetRepository.findById(14L)).thenReturn(Optional.of(jsonAsset));

        LandmarkDto result = assertDoesNotThrow(() -> landmarkService.create(baseRequest(LandmarkType.ciudad, null, 14L)));

        assertEquals(14L, result.mapAssetId());
        assertEquals("json", result.mapAssetKind());
    }

    @Test
    void updateKeepsAllowingCityWithBuildingsMap() {
        LandmarkEntity existing = new LandmarkEntity();
        existing.setId(99L);
        when(landmarkRepository.findById(99L)).thenReturn(Optional.of(existing));

        LandmarkMapRequest buildingsMap = new LandmarkMapRequest(
            LandmarkMapKind.buildings,
            LandmarkMapSource.external,
            null,
            "https://example.com/buildings.json",
            null,
            null
        );

        LandmarkDto result = assertDoesNotThrow(() -> landmarkService.update(99L, baseRequest(LandmarkType.ciudad, buildingsMap, null)));

        assertEquals(99L, result.id());
        verify(landmarkMapRefRepository).save(any());
    }

    private static Stream<Arguments> dungeonMapReferences() {
        return Stream.of(
            Arguments.of(new LandmarkMapRequest(LandmarkMapKind.external, null, null, "https://example.com/map.png", null, null)),
            Arguments.of(new LandmarkMapRequest(LandmarkMapKind.asset, null, "map.png", null, null, null)),
            Arguments.of(new LandmarkMapRequest(LandmarkMapKind.buildings, LandmarkMapSource.external, null, "https://example.com/buildings.json", null, null))
        );
    }

    private static LandmarkUpsertRequest baseRequest(LandmarkType type, LandmarkMapRequest mapRequest, Long mapAssetId) {
        return new LandmarkUpsertRequest(
            "icono",
            "Landmark de prueba",
            type,
            null,
            null,
            1.0,
            1.0,
            true,
            List.of(0.5, 0.5),
            List.of("tag"),
            100,
            "descripcion",
            "historia",
            List.of(),
            0,
            false,
            48.0,
            0.0,
            0.0,
            null,
            null,
            mapRequest,
            mapAssetId
        );
    }

    private static MediaAssetEntity mediaAsset(Long id, MediaAssetKind kind, String textContent) {
        MediaAssetEntity asset = new MediaAssetEntity();
        asset.setId(id);
        asset.setKind(kind);
        asset.setFilename(kind.name() + ".asset");
        asset.setContentType(kind == MediaAssetKind.image ? "image/png" : "application/json");
        asset.setByteSize(64L);
        asset.setTextContent(textContent);
        return asset;
    }
}
