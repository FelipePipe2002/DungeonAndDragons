package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.BuildingDto;
import com.sistema.dnd.sistema.dto.domain.CharacterDto;
import com.sistema.dnd.sistema.dto.domain.CharacterSheetData;
import com.sistema.dnd.sistema.dto.domain.EventDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationMemberDto;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.EventEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import com.sistema.dnd.sistema.entity.enums.EventOwnerType;
import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.EventRepository;
import com.sistema.dnd.sistema.repository.OrganizationLandmarkRepository;
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

    private final EventRepository eventRepository;
    private final BuildingRepository buildingRepository;
    private final CharacterRepository characterRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationLandmarkRepository organizationLandmarkRepository;
    private final OrganizationMembershipRepository organizationMembershipRepository;
    private final TaggingService taggingService;
    private final ObjectMapper objectMapper;

    public DomainMapper(
        EventRepository eventRepository,
        BuildingRepository buildingRepository,
        CharacterRepository characterRepository,
        OrganizationRepository organizationRepository,
        OrganizationLandmarkRepository organizationLandmarkRepository,
        OrganizationMembershipRepository organizationMembershipRepository,
        TaggingService taggingService,
        ObjectMapper objectMapper
    ) {
        this.eventRepository = eventRepository;
        this.buildingRepository = buildingRepository;
        this.characterRepository = characterRepository;
        this.organizationRepository = organizationRepository;
        this.organizationLandmarkRepository = organizationLandmarkRepository;
        this.organizationMembershipRepository = organizationMembershipRepository;
        this.taggingService = taggingService;
        this.objectMapper = objectMapper;
    }

    public LandmarkDto toLandmarkDto(
        LandmarkEntity landmark,
        boolean includeBuildings,
        boolean includeCharacters,
        boolean includeOrganizations
    ) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.landmark, landmark.getId());

        List<EventDto> eventos = eventRepository.findByOwnerTypeAndOwnerIdOrderByIdDesc(EventOwnerType.landmark, landmark.getId())
            .stream()
            .map(this::toEventDto)
            .toList();

        LandmarkMapDto mapa = toLandmarkMapDto(landmark);

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
            landmark.getEstado() != null ? landmark.getEstado().getId() : null,
            landmark.getSubdivision() != null ? landmark.getSubdivision().getId() : null,
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
            landmark.getOrganizationMapLinks(),
            landmark.getHiddenMapBuildings(),
            landmark.getDungeonGeneratorConfig(),
            mapa,
            edificios,
            personajes,
            organizaciones
        );
    }

    public BuildingDto toBuildingDto(BuildingEntity building) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.building, building.getId());
        LandmarkMapDto mapa = toLandmarkMapDto(building);

        return new BuildingDto(
            building.getId(),
            building.getLandmark() != null ? building.getLandmark().getId() : null,
            building.getNombre(),
            toPosition(building.getPosicionX(), building.getPosicionY()),
            building.getDescripcion(),
            tags,
            building.getDueno() != null ? building.getDueno().getId() : null,
            building.getMapBuildingIndex(),
            building.getOrganization() != null ? building.getOrganization().getId() : null,
            building.getMapAsset() != null ? building.getMapAsset().getId() : null,
            building.getMapAsset() != null ? building.getMapAsset().getKind().name() : null,
            building.getMapRotationDegrees(),
            building.getMapGridEnabled(),
            building.getMapGridCellSize(),
            building.getMapGridOffsetX(),
            building.getMapGridOffsetY(),
            mapa
        );
    }

    public CharacterDto toCharacterDto(CharacterEntity character) {
        List<String> tags = taggingService.findTagNames(TaggableEntityType.character, character.getId());
        CharacterSheetData characterSheet = readCharacterSheet(character.getCharacterSheet());

        List<EventDto> eventos = eventRepository.findByOwnerTypeAndOwnerIdOrderByIdDesc(EventOwnerType.character, character.getId())
            .stream()
            .map(this::toEventDto)
            .toList();

        List<Long> buildingIds = buildingRepository.findByDuenoIdOrderByNombreAsc(character.getId()).stream()
            .map(BuildingEntity::getId)
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

        Set<Long> landmarks = new LinkedHashSet<>();
        organizationLandmarkRepository.findByOrganizationId(organization.getId()).stream()
            .map(item -> item.getLandmarkId())
            .filter(id -> id != null && id > 0)
            .forEach(landmarks::add);
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

        List<OrganizationMembershipEntity> memberships = organizationMembershipRepository.findByOrganizationId(organization.getId());

        List<OrganizationMemberDto> miembros = memberships
            .stream()
            .sorted(Comparator.comparing(item -> item.getCharacter().getNombre(), String.CASE_INSENSITIVE_ORDER))
            .map(this::toOrganizationMemberDto)
            .toList();

        List<String> categorias = memberships.stream()
            .map(OrganizationMembershipEntity::getCategoria)
            .filter(value -> value != null && !value.isBlank())
            .distinct()
            .sorted(String.CASE_INSENSITIVE_ORDER)
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

    private LandmarkMapDto toLandmarkMapDto(LandmarkEntity landmark) {
        if (landmark.getMapKind() == null) {
            return null;
        }

        return new LandmarkMapDto(
            landmark.getMapKind().name(),
            landmark.getMapSource() != null ? landmark.getMapSource().name() : null,
            landmark.getMapFilename(),
            landmark.getMapUrl(),
            landmark.getMapStorageKey(),
            landmark.getMapDataUrl()
        );
    }

    private LandmarkMapDto toLandmarkMapDto(BuildingEntity building) {
        if (building.getMapKind() == null) {
            return null;
        }

        return new LandmarkMapDto(
            building.getMapKind().name(),
            building.getMapSource() != null ? building.getMapSource().name() : null,
            building.getMapFilename(),
            building.getMapUrl(),
            building.getMapStorageKey(),
            building.getMapDataUrl()
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

    private EventDto toEventDto(EventEntity event) {
        return new EventDto(
            event.getId(),
            event.getTitulo(),
            event.getDescripcion(),
            event.getFecha(),
            event.getSesion()
        );
    }

    private CharacterSheetData readCharacterSheet(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(value, CharacterSheetData.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo deserializar el characterSheet", exception);
        }
    }
}
