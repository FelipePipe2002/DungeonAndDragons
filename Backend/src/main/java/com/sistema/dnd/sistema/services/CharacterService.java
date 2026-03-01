package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.CharacterDto;
import com.sistema.dnd.sistema.dto.domain.CharacterEventRequest;
import com.sistema.dnd.sistema.dto.domain.CharacterUpsertRequest;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterBuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.CharacterEventEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import com.sistema.dnd.sistema.entity.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterBuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterEventRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
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
    private final CharacterEventRepository characterEventRepository;
    private final CharacterBuildingRepository characterBuildingRepository;
    private final LandmarkRepository landmarkRepository;
    private final BuildingRepository buildingRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository organizationMembershipRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;
    private final CharacterSheetJsonCodec characterSheetJsonCodec;

    public CharacterService(
        CharacterRepository characterRepository,
        CharacterEventRepository characterEventRepository,
        CharacterBuildingRepository characterBuildingRepository,
        LandmarkRepository landmarkRepository,
        BuildingRepository buildingRepository,
        OrganizationRepository organizationRepository,
        OrganizationMembershipRepository organizationMembershipRepository,
        MediaAssetRepository mediaAssetRepository,
        TaggingService taggingService,
        DomainMapper domainMapper,
        CharacterSheetJsonCodec characterSheetJsonCodec
    ) {
        this.characterRepository = characterRepository;
        this.characterEventRepository = characterEventRepository;
        this.characterBuildingRepository = characterBuildingRepository;
        this.landmarkRepository = landmarkRepository;
        this.buildingRepository = buildingRepository;
        this.organizationRepository = organizationRepository;
        this.organizationMembershipRepository = organizationMembershipRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
        this.characterSheetJsonCodec = characterSheetJsonCodec;
    }

    public List<CharacterDto> findAll() {
        return characterRepository.findAll().stream().map(domainMapper::toCharacterDto).toList();
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
        entity.setNombre(requiredTrimmed(request.nombre(), "El nombre del personaje es obligatorio"));
        entity.setClase(normalizedOrEmpty(request.clase()));
        entity.setRaza(normalizedOrEmpty(request.raza()));
        entity.setDescripcion(normalizedOrEmpty(request.descripcion()));
        entity.setPlayer(request.isPlayer());
        entity.setCharacterSheet(characterSheetJsonCodec.write(request.characterSheet()));
        Long imagenAssetId = request.imagenAssetId();
        if (imagenAssetId != null && imagenAssetId > 0) {
            entity.setImagenAsset(resolveImageAsset(imagenAssetId));
            entity.setImagen(null);
        } else {
            entity.setImagenAsset(null);
            entity.setImagen(optionalTrimmed(request.imagen()));
        }
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

        characterEventRepository.deleteByCharacterId(character.getId());
        characterBuildingRepository.deleteByCharacterId(character.getId());
        characterEventRepository.flush();
        characterBuildingRepository.flush();

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

        List<CharacterEventRequest> events = request.eventos() == null ? List.of() : request.eventos();
        // Persist in reverse so repository OrderByIdDesc returns the same order received from frontend.
        for (int index = events.size() - 1; index >= 0; index--) {
            CharacterEventRequest event = events.get(index);
            CharacterEventEntity item = new CharacterEventEntity();
            item.setCharacter(character);
            item.setSesion(requiredTrimmed(event.sesion(), "La sesion es obligatoria"));
            item.setDescripcion(normalizedOrEmpty(event.descripcion()));
            item.setFecha(optionalTrimmed(event.fecha()));
            characterEventRepository.save(item);
        }

        for (Long buildingId : buildingIds) {
            CharacterBuildingEntity link = new CharacterBuildingEntity();
            link.setCharacter(character);
            link.setBuilding(buildingsById.get(buildingId));
            characterBuildingRepository.save(link);
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

    private MediaAssetEntity resolveImageAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId debe apuntar a un asset de imagen");
        }
        return asset;
    }
}
