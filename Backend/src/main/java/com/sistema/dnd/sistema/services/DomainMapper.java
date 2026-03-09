package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BuildingDto;
import com.sistema.dnd.sistema.dto.domain.CharacterDto;
import com.sistema.dnd.sistema.dto.domain.CharacterEventDto;
import com.sistema.dnd.sistema.dto.domain.CharacterSheetData;
import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkEventDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationMemberDto;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.LandmarkMapRefEntity;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import com.sistema.dnd.sistema.entity.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterBuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterEventRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.LandmarkEventRepository;
import com.sistema.dnd.sistema.repository.LandmarkMapRefRepository;
import com.sistema.dnd.sistema.repository.OrganizationCategoryRepository;
import com.sistema.dnd.sistema.repository.OrganizationMembershipRepository;
import com.sistema.dnd.sistema.repository.OrganizationRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class DomainMapper {

    private final LandmarkEventRepository landmarkEventRepository;
    private final LandmarkMapRefRepository landmarkMapRefRepository;
    private final BuildingRepository buildingRepository;
    private final CharacterRepository characterRepository;
    private final CharacterEventRepository characterEventRepository;
    private final CharacterBuildingRepository characterBuildingRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationCategoryRepository organizationCategoryRepository;
    private final OrganizationMembershipRepository organizationMembershipRepository;
    private final TaggingService taggingService;
    private final CharacterSheetJsonCodec characterSheetJsonCodec;

    public DomainMapper(
        LandmarkEventRepository landmarkEventRepository,
        LandmarkMapRefRepository landmarkMapRefRepository,
        BuildingRepository buildingRepository,
        CharacterRepository characterRepository,
        CharacterEventRepository characterEventRepository,
        CharacterBuildingRepository characterBuildingRepository,
        OrganizationRepository organizationRepository,
        OrganizationCategoryRepository organizationCategoryRepository,
        OrganizationMembershipRepository organizationMembershipRepository,
        TaggingService taggingService,
        CharacterSheetJsonCodec characterSheetJsonCodec
    ) {
        this.landmarkEventRepository = landmarkEventRepository;
        this.landmarkMapRefRepository = landmarkMapRefRepository;
        this.buildingRepository = buildingRepository;
        this.characterRepository = characterRepository;
        this.characterEventRepository = characterEventRepository;
        this.characterBuildingRepository = characterBuildingRepository;
        this.organizationRepository = organizationRepository;
        this.organizationCategoryRepository = organizationCategoryRepository;
        this.organizationMembershipRepository = organizationMembershipRepository;
        this.taggingService = taggingService;
        this.characterSheetJsonCodec = characterSheetJsonCodec;
    }

    public LandmarkDto toLandmarkDto(
        LandmarkEntity landmark,
        boolean includeBuildings,
        boolean includeCharacters,
        boolean includeOrganizations
    ) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.landmark, landmark.getId());

        List<LandmarkEventDto> eventos = landmarkEventRepository.findByLandmarkIdOrderByIdDesc(landmark.getId())
            .stream()
            .map(event -> new LandmarkEventDto(
                event.getNombre(),
                event.getDescripcion(),
                event.getFecha(),
                toPosition(event.getPosicionX(), event.getPosicionY())
            ))
            .toList();

        LandmarkMapDto mapa = landmarkMapRefRepository.findByLandmarkId(landmark.getId())
            .map(this::toLandmarkMapDto)
            .orElse(null);

        List<BuildingDto> edificios = includeBuildings
            ? buildingRepository.findByLandmarkIdOrderByNombreAsc(landmark.getId()).stream().map(this::toBuildingDto).toList()
            : List.of();

        List<CharacterDto> personajes = includeCharacters
            ? characterRepository.findByLandmarkIdOrderByNombreAsc(landmark.getId()).stream().map(this::toCharacterDto).toList()
            : List.of();

        List<OrganizationDto> organizaciones;
        if (includeOrganizations) {
            Set<Long> ids = buildingRepository.findByLandmarkIdOrderByNombreAsc(landmark.getId())
                .stream()
                .map(BuildingEntity::getOrganization)
                .filter(org -> org != null)
                .map(OrganizationEntity::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));

            organizationMembershipRepository.findByCharacterLandmarkId(landmark.getId()).stream()
                .map(item -> item.getOrganization().getId())
                .forEach(ids::add);

            organizaciones = organizationRepository.findAllById(ids).stream()
                .sorted(Comparator.comparing(OrganizationEntity::getNombre, String.CASE_INSENSITIVE_ORDER))
                .map(this::toOrganizationDto)
                .toList();
        } else {
            organizaciones = List.of();
        }

        return new LandmarkDto(
            landmark.getId(),
            landmark.getIcono(),
            landmark.getNombre(),
            landmark.getTipo().name(),
            landmark.getEscalaIcono(),
            landmark.getEscalaTexto(),
            landmark.getMostrarLeyenda(),
            toPosition(landmark.getPosicionX(), landmark.getPosicionY()),
            tags,
            landmark.getPoblacion(),
            landmark.getDescripcionCorta(),
            landmark.getHistoria(),
            eventos,
            landmark.getMapAsset() != null ? landmark.getMapAsset().getId() : null,
            landmark.getMapAsset() != null ? landmark.getMapAsset().getKind().name() : null,
            landmark.getMapRotationDegrees(),
            landmark.getMapGridEnabled(),
            landmark.getMapGridCellSize(),
            landmark.getMapGridOffsetX(),
            landmark.getMapGridOffsetY(),
            mapa,
            edificios,
            personajes,
            organizaciones
        );
    }

    public BuildingDto toBuildingDto(BuildingEntity building) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.building, building.getId());

        return new BuildingDto(
            building.getId(),
            building.getLandmark() != null ? building.getLandmark().getId() : null,
            building.getNombre(),
            toPosition(building.getPosicionX(), building.getPosicionY()),
            building.getDescripcion(),
            tags,
            building.getDueno() != null ? building.getDueno().getId() : null,
            building.getMapBuildingIndex(),
            building.getOrganization() != null ? building.getOrganization().getId() : null
        );
    }

    public CharacterDto toCharacterDto(CharacterEntity character) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.character, character.getId());
        CharacterSheetData characterSheet = characterSheetJsonCodec.read(character.getCharacterSheet());

        List<CharacterEventDto> eventos = characterEventRepository.findByCharacterIdOrderByIdDesc(character.getId())
            .stream()
            .map(event -> new CharacterEventDto(
                event.getSesion(),
                event.getDescripcion(),
                event.getFecha()
            ))
            .toList();

        List<Long> buildingIds = characterBuildingRepository.findByCharacterId(character.getId()).stream()
            .map(item -> item.getBuilding().getId())
            .distinct()
            .toList();

        List<Long> organizationIds = organizationMembershipRepository.findByCharacterId(character.getId()).stream()
            .map(item -> item.getOrganization().getId())
            .distinct()
            .toList();

        return new CharacterDto(
            character.getId(),
            character.getNombre(),
            character.getClase(),
            character.getRaza(),
            character.getDescripcion(),
            character.isPlayer(),
            characterSheet,
            tags,
            character.getImagen(),
            character.getImagenAsset() != null ? character.getImagenAsset().getId() : null,
            character.getTokenImageFocusX(),
            character.getTokenImageFocusY(),
            character.getTokenImageZoom(),
            character.getInitiativeImageFocusX(),
            character.getInitiativeImageFocusY(),
            character.getInitiativeImageZoom(),
            character.getLandmark() != null ? character.getLandmark().getId() : 0L,
            buildingIds,
            organizationIds,
            eventos
        );
    }

    public OrganizationDto toOrganizationDto(OrganizationEntity organization) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.organization, organization.getId());

        List<String> categorias = organizationCategoryRepository.findByOrganizationIdOrderByCategoriaAsc(organization.getId())
            .stream()
            .map(item -> item.getCategoria())
            .toList();

        Set<Long> landmarks = new LinkedHashSet<>();
        buildingRepository.findByOrganizationIdOrderByNombreAsc(organization.getId()).stream()
            .map(BuildingEntity::getLandmark)
            .filter(item -> item != null && item.getId() != null && item.getId() > 0)
            .map(item -> item.getId())
            .forEach(landmarks::add);
        organizationMembershipRepository.findByOrganizationId(organization.getId()).stream()
            .map(item -> item.getCharacter().getLandmark() != null ? item.getCharacter().getLandmark().getId() : null)
            .filter(id -> id != null && id > 0)
            .forEach(landmarks::add);

        List<Long> edificios = buildingRepository.findByOrganizationIdOrderByNombreAsc(organization.getId())
            .stream()
            .map(BuildingEntity::getId)
            .toList();

        List<OrganizationMemberDto> miembros = organizationMembershipRepository.findByOrganizationId(organization.getId())
            .stream()
            .sorted(Comparator.comparing(item -> item.getCharacter().getNombre(), String.CASE_INSENSITIVE_ORDER))
            .map(this::toOrganizationMemberDto)
            .toList();

        return new OrganizationDto(
            organization.getId(),
            organization.getNombre(),
            organization.getDescripcion(),
            tags,
            organization.getImagen(),
            organization.getImagenAsset() != null ? organization.getImagenAsset().getId() : null,
            categorias,
            edificios,
            miembros,
            landmarks.stream().toList()
        );
    }

    private OrganizationMemberDto toOrganizationMemberDto(OrganizationMembershipEntity membership) {
        CharacterEntity character = membership.getCharacter();
        return new OrganizationMemberDto(
            character.getId(),
            character.getNombre(),
            character.getClase(),
            character.getRaza(),
            character.getLandmark() != null ? character.getLandmark().getId() : 0L,
            membership.getCategoria()
        );
    }

    private LandmarkMapDto toLandmarkMapDto(LandmarkMapRefEntity mapRef) {
        return new LandmarkMapDto(
            mapRef.getKind().name(),
            mapRef.getSource() != null ? mapRef.getSource().name() : null,
            mapRef.getFilename(),
            mapRef.getUrl(),
            mapRef.getStorageKey(),
            mapRef.getDataUrl()
        );
    }

    private List<Double> toPosition(Double x, Double y) {
        if (x == null || y == null) {
            return null;
        }

        List<Double> position = new ArrayList<>(2);
        position.add(x);
        position.add(y);
        return position;
    }
}
