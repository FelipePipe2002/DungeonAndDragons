package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.CharacterDto;
import com.sistema.dnd.sistema.dto.domain.CharacterSheetData;
import com.sistema.dnd.sistema.dto.domain.CharacterUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.EventDto;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.EventEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import com.sistema.dnd.sistema.entity.enums.EventOwnerType;
import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.EventRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import com.sistema.dnd.sistema.repository.OrganizationMembershipRepository;
import com.sistema.dnd.sistema.repository.OrganizationRepository;
import jakarta.transaction.Transactional;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CharacterService {

    private final CharacterRepository characterRepository;
    private final EventRepository eventRepository;
    private final LandmarkRepository landmarkRepository;
    private final BuildingRepository buildingRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository organizationMembershipRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;
    private final ObjectMapper objectMapper;

    public CharacterService(
        CharacterRepository characterRepository,
        EventRepository eventRepository,
        LandmarkRepository landmarkRepository,
        BuildingRepository buildingRepository,
        OrganizationRepository organizationRepository,
        OrganizationMembershipRepository organizationMembershipRepository,
        MediaAssetRepository mediaAssetRepository,
        TaggingService taggingService,
        DomainMapper domainMapper,
        ObjectMapper objectMapper
    ) {
        this.characterRepository = characterRepository;
        this.eventRepository = eventRepository;
        this.landmarkRepository = landmarkRepository;
        this.buildingRepository = buildingRepository;
        this.organizationRepository = organizationRepository;
        this.organizationMembershipRepository = organizationMembershipRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
        this.objectMapper = objectMapper;
    }

    public List<CharacterDto> findAll() {
        return characterRepository.findAll().stream().map(domainMapper::toCharacterDto).toList();
    }

    public List<CharacterDto> findByPlayer(boolean player) {
        return characterRepository.findByPlayerOrderByNombreAsc(player).stream().map(domainMapper::toCharacterDto).toList();
    }

    public CharacterDto findById(Long id) {
        CharacterEntity entity = characterRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Personaje no encontrado"));
        return domainMapper.toCharacterDto(entity);
    }

    @Transactional
    public CharacterDto create(CharacterUpsertRequest request) {
        CharacterEntity entity = new CharacterEntity();
        applyUpsert(entity, request);
        CharacterEntity saved = characterRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toCharacterDto(saved);
    }

    @Transactional
    public CharacterDto update(Long id, CharacterUpsertRequest request) {
        CharacterEntity entity = characterRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Personaje no encontrado"));

        applyUpsert(entity, request);
        CharacterEntity saved = characterRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toCharacterDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        CharacterEntity entity = characterRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Personaje no encontrado"));

        for (BuildingEntity building : buildingRepository.findByDuenoIdOrderByNombreAsc(id)) {
            building.setDueno(null);
            buildingRepository.save(building);
        }

        characterRepository.delete(entity);
    }

    private void applyUpsert(CharacterEntity entity, CharacterUpsertRequest request) {
        Long landmarkId = request.landmarkId();
        if (landmarkId == null || landmarkId <= 0) {
            entity.setLandmark(null);
        } else {
            LandmarkEntity landmark = landmarkRepository.findById(landmarkId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarkId invalido"));
            entity.setLandmark(landmark);
        }
        entity.setNombre(requiredTrimmed(request.name(), "El nombre del personaje es obligatorio"));
        entity.setClase(normalizedOrEmpty(request.characterClass()));
        entity.setRaza(normalizedOrEmpty(request.race()));
        entity.setDescripcion(normalizedOrEmpty(request.description()));
        entity.setPlayer(request.isPlayer());
        entity.setCharacterSheet(writeCharacterSheet(request.characterSheet()));
        Long imagenAssetId = request.imageAssetId();
        if (imagenAssetId != null && imagenAssetId > 0) {
            entity.setImagenAsset(resolveImageAsset(imagenAssetId));
            entity.setImagen(null);
        } else {
            entity.setImagenAsset(null);
            entity.setImagen(optionalTrimmed(request.image()));
        }
        entity.setTokenImageFocusX(clampPercentage(request.tokenImageFocusX()));
        entity.setTokenImageFocusY(clampPercentage(request.tokenImageFocusY()));
        entity.setTokenImageZoom(clampZoom(request.tokenImageZoom()));
        entity.setInitiativeImageFocusX(clampPercentage(request.initiativeImageFocusX()));
        entity.setInitiativeImageFocusY(clampPercentage(request.initiativeImageFocusY()));
        entity.setInitiativeImageZoom(clampZoom(request.initiativeImageZoom()));
    }

    private void syncChildren(CharacterEntity character, CharacterUpsertRequest request) {
        List<Long> buildingIds = dedupeLongs(request.buildingIds());
        List<Long> organizationIds = dedupeLongs(request.organizationIds());

        Map<Long, BuildingEntity> buildingsById = buildingRepository.findAllById(buildingIds)
            .stream()
            .collect(Collectors.toMap(BuildingEntity::getId, value -> value));

        if (buildingsById.size() != buildingIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingIds contiene ids invalidos");
        }

        Map<Long, OrganizationEntity> organizationsById = organizationRepository.findAllById(organizationIds)
            .stream()
            .collect(Collectors.toMap(OrganizationEntity::getId, value -> value));

        if (organizationsById.size() != organizationIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "organizationIds contiene ids invalidos");
        }

        eventRepository.deleteByOwnerTypeAndOwnerId(EventOwnerType.character, character.getId());
        eventRepository.flush();

        Map<Long, String> previousMembershipCategoryByOrg = organizationMembershipRepository.findByCharacterId(character.getId())
            .stream()
            .collect(Collectors.toMap(
                item -> item.getOrganization().getId(),
                OrganizationMembershipEntity::getCategoria,
                (left, right) -> right,
                LinkedHashMap::new
            ));

        organizationMembershipRepository.deleteByCharacterId(character.getId());
        organizationMembershipRepository.flush();

        taggingService.replaceTags(TaggableEntityType.character, character.getId(), request.tags());

        List<EventDto> events = request.events() == null ? List.of() : request.events();
        // Persist in reverse so repository OrderByIdDesc returns the same order received from frontend.
        for (int index = events.size() - 1; index >= 0; index--) {
            EventDto event = events.get(index);
            EventEntity item = new EventEntity();
            item.setOwnerType(EventOwnerType.character);
            item.setOwnerId(character.getId());
            item.setTitulo(requiredTrimmed(event.title(), "El titulo del evento es obligatorio"));
            item.setDescripcion(normalizedOrEmpty(event.description()));
            item.setFecha(optionalTrimmed(event.date()));
            item.setSesion(optionalTrimmed(event.session()));
            eventRepository.save(item);
        }

        for (BuildingEntity building : buildingRepository.findByDuenoIdOrderByNombreAsc(character.getId())) {
            if (!buildingsById.containsKey(building.getId())) {
                building.setDueno(null);
                buildingRepository.save(building);
            }
        }

        for (Long buildingId : buildingIds) {
            BuildingEntity building = buildingsById.get(buildingId);
            if (building.getDueno() == null || !character.getId().equals(building.getDueno().getId())) {
                building.setDueno(character);
                buildingRepository.save(building);
            }
        }

        for (Long organizationId : organizationIds) {
            OrganizationMembershipEntity membership = new OrganizationMembershipEntity();
            membership.setOrganization(organizationsById.get(organizationId));
            membership.setCharacter(character);
            membership.setCategoria(previousMembershipCategoryByOrg.getOrDefault(organizationId, ""));
            organizationMembershipRepository.save(membership);
        }
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizedOrEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String optionalTrimmed(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private List<Long> dedupeLongs(List<Long> values) {
        if (values == null || values.isEmpty()) return List.of();
        Set<Long> result = new LinkedHashSet<>();
        for (Long value : values) {
            if (value != null) result.add(value);
        }
        return result.stream().toList();
    }

    private Double clampPercentage(Double value) {
        if (value == null || !Double.isFinite(value)) {
            return null;
        }
        return Math.max(0d, Math.min(100d, value));
    }

    private Double clampZoom(Double value) {
        if (value == null || !Double.isFinite(value)) {
            return null;
        }
        return Math.max(1d, Math.min(3d, value));
    }

    private MediaAssetEntity resolveImageAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId debe apuntar a un asset de imagen");
        }
        return asset;
    }

    private String writeCharacterSheet(CharacterSheetData value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo serializar el characterSheet", exception);
        }
    }
}
