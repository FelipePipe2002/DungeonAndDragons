package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.OrganizationDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationMemberRequest;
import com.sistema.dnd.sistema.dto.domain.OrganizationUpsertRequest;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.OrganizationLandmarkEntity;
import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import com.sistema.dnd.sistema.repository.OrganizationMembershipRepository;
import com.sistema.dnd.sistema.repository.OrganizationLandmarkRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
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
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository organizationMembershipRepository;
    private final OrganizationLandmarkRepository organizationLandmarkRepository;
    private final BuildingRepository buildingRepository;
    private final CharacterRepository characterRepository;
    private final LandmarkRepository landmarkRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;

    public OrganizationService(
        OrganizationRepository organizationRepository,
        OrganizationMembershipRepository organizationMembershipRepository,
        OrganizationLandmarkRepository organizationLandmarkRepository,
        BuildingRepository buildingRepository,
        CharacterRepository characterRepository,
        LandmarkRepository landmarkRepository,
        MediaAssetRepository mediaAssetRepository,
        TaggingService taggingService,
        DomainMapper domainMapper
    ) {
        this.organizationRepository = organizationRepository;
        this.organizationMembershipRepository = organizationMembershipRepository;
        this.organizationLandmarkRepository = organizationLandmarkRepository;
        this.buildingRepository = buildingRepository;
        this.characterRepository = characterRepository;
        this.landmarkRepository = landmarkRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
    }

    public List<OrganizationDto> findAll() {
        return organizationRepository.findAll().stream().map(domainMapper::toOrganizationDto).toList();
    }

    public OrganizationDto findById(Long id) {
        OrganizationEntity entity = organizationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organizacion no encontrada"));
        return domainMapper.toOrganizationDto(entity);
    }

    @Transactional
    public OrganizationDto create(OrganizationUpsertRequest request) {
        OrganizationEntity entity = new OrganizationEntity();
        applyUpsert(entity, request);
        OrganizationEntity saved = organizationRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toOrganizationDto(saved);
    }

    @Transactional
    public OrganizationDto update(Long id, OrganizationUpsertRequest request) {
        OrganizationEntity entity = organizationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organizacion no encontrada"));

        applyUpsert(entity, request);
        OrganizationEntity saved = organizationRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toOrganizationDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        OrganizationEntity entity = organizationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organizacion no encontrada"));
        organizationRepository.delete(entity);
    }

    private void applyUpsert(OrganizationEntity entity, OrganizationUpsertRequest request) {
        entity.setNombre(requiredTrimmed(request.name(), "El nombre de la organizacion es obligatorio"));
        entity.setDescripcion(normalizedOrEmpty(request.description()));
        Long imagenAssetId = request.imageAssetId();
        if (imagenAssetId != null && imagenAssetId > 0) {
            entity.setImagenAsset(resolveImageAsset(imagenAssetId));
            entity.setImagen(null);
        } else {
            entity.setImagenAsset(null);
            entity.setImagen(optionalTrimmed(request.image()));
        }
    }

    private void syncChildren(OrganizationEntity organization, OrganizationUpsertRequest request) {
        List<Long> buildingIds = dedupeLongs(request.buildingIds());

        Map<Long, BuildingEntity> requestedBuildingsById = buildingRepository.findAllById(buildingIds)
            .stream().collect(Collectors.toMap(BuildingEntity::getId, value -> value));
        if (requestedBuildingsById.size() != buildingIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingIds contiene ids invalidos");
        }

        Map<Long, String> categoryByCharacterId = dedupeMemberCategories(request.members());
        Map<Long, CharacterEntity> charactersById = characterRepository.findAllById(categoryByCharacterId.keySet())
            .stream().collect(Collectors.toMap(CharacterEntity::getId, value -> value));
        if (charactersById.size() != categoryByCharacterId.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "members contiene characterId invalido");
        }

        organizationMembershipRepository.deleteByOrganizationId(organization.getId());
        organizationLandmarkRepository.deleteByOrganizationId(organization.getId());
        organizationMembershipRepository.flush();

        taggingService.replaceTags(TaggableEntityType.organization, organization.getId(), request.tags());

        for (Map.Entry<Long, String> entry : categoryByCharacterId.entrySet()) {
            OrganizationMembershipEntity item = new OrganizationMembershipEntity();
            item.setOrganization(organization);
            item.setCharacter(charactersById.get(entry.getKey()));
            item.setCategoria(entry.getValue());
            organizationMembershipRepository.save(item);
        }

        List<Long> landmarkIds = dedupeLongs(request.landmarks());
        Map<Long, LandmarkEntity> landmarksById = landmarkRepository.findAllById(landmarkIds)
            .stream().collect(Collectors.toMap(LandmarkEntity::getId, value -> value));
        if (landmarksById.size() != landmarkIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarks contiene ids invalidos");
        }

        for (Long landmarkId : landmarkIds) {
            OrganizationLandmarkEntity item = new OrganizationLandmarkEntity();
            item.setOrganization(organization);
            item.setLandmark(landmarksById.get(landmarkId));
            organizationLandmarkRepository.save(item);
        }

        List<BuildingEntity> currentlyLinked = buildingRepository.findByOrganizationIdOrderByNombreAsc(organization.getId());
        Set<Long> requestedBuildingIds = new LinkedHashSet<>(buildingIds);

        for (BuildingEntity building : currentlyLinked) {
            if (!requestedBuildingIds.contains(building.getId())) {
                building.setOrganization(null);
                buildingRepository.save(building);
            }
        }

        for (Long buildingId : buildingIds) {
            BuildingEntity building = requestedBuildingsById.get(buildingId);
            building.setOrganization(organization);
            buildingRepository.save(building);
        }
    }

    private Map<Long, String> dedupeMemberCategories(List<OrganizationMemberRequest> members) {
        Map<Long, String> result = new LinkedHashMap<>();
        if (members == null || members.isEmpty()) return result;

        for (OrganizationMemberRequest member : members) {
            if (member == null || member.characterId() == null) continue;
            result.put(member.characterId(), normalizedOrEmpty(member.category()));
        }

        return result;
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

    private List<String> dedupeStrings(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        Set<String> result = new LinkedHashSet<>();
        for (String value : values) {
            String normalized = optionalTrimmed(value);
            if (normalized != null) result.add(normalized);
        }
        return result.stream().toList();
    }

    private List<Long> dedupeLongs(List<Long> values) {
        if (values == null || values.isEmpty()) return List.of();
        Set<Long> result = new LinkedHashSet<>();
        for (Long value : values) {
            if (value != null) result.add(value);
        }
        return result.stream().toList();
    }

    private MediaAssetEntity resolveImageAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId debe apuntar a un asset de imagen");
        }
        return asset;
    }
}
