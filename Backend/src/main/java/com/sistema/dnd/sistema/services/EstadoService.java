package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.EstadoDto;
import com.sistema.dnd.sistema.dto.domain.EstadoLandmarkRoleDto;
import com.sistema.dnd.sistema.dto.domain.EstadoMemberDto;
import com.sistema.dnd.sistema.dto.domain.EstadoUpsertRequest;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.EstadoEntity;
import com.sistema.dnd.sistema.entity.EstadoLandmarkRoleEntity;
import com.sistema.dnd.sistema.entity.EstadoMemberEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.EstadoRepository;
import com.sistema.dnd.sistema.repository.EstadoLandmarkRoleRepository;
import com.sistema.dnd.sistema.repository.EstadoMemberRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EstadoService {

    private final EstadoRepository estadoRepository;
    private final EstadoMemberRepository estadoMemberRepository;
    private final EstadoLandmarkRoleRepository estadoLandmarkRoleRepository;
    private final CharacterRepository characterRepository;
    private final LandmarkRepository landmarkRepository;
    private final MediaAssetRepository mediaAssetRepository;

    public EstadoService(
        EstadoRepository estadoRepository,
        EstadoMemberRepository estadoMemberRepository,
        EstadoLandmarkRoleRepository estadoLandmarkRoleRepository,
        CharacterRepository characterRepository,
        LandmarkRepository landmarkRepository,
        MediaAssetRepository mediaAssetRepository
    ) {
        this.estadoRepository = estadoRepository;
        this.estadoMemberRepository = estadoMemberRepository;
        this.estadoLandmarkRoleRepository = estadoLandmarkRoleRepository;
        this.characterRepository = characterRepository;
        this.landmarkRepository = landmarkRepository;
        this.mediaAssetRepository = mediaAssetRepository;
    }

    @Transactional(readOnly = true)
    public List<EstadoDto> findAll(Long estadoPadreId) {
        if (estadoPadreId != null && estadoPadreId > 0) {
            return estadoRepository.findByEstadoPadre_IdOrderByNombreAsc(estadoPadreId)
                .stream()
                .map(this::toDto)
                .toList();
        }

        return estadoRepository.findByEstadoPadreIsNullOrderByNombreAsc()
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public EstadoDto findById(Long id) {
        EstadoEntity entity = estadoRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estado no encontrado"));
        return toDto(entity);
    }

    @Transactional
    public EstadoDto create(EstadoUpsertRequest request) {
        EstadoEntity entity = new EstadoEntity();
        applyUpsert(entity, request);
        EstadoEntity saved = estadoRepository.save(entity);
        syncChildren(saved, request);
        return toDto(saved);
    }

    @Transactional
    public EstadoDto update(Long id, EstadoUpsertRequest request) {
        EstadoEntity entity = estadoRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estado no encontrado"));
        applyUpsert(entity, request);
        EstadoEntity saved = estadoRepository.save(entity);
        syncChildren(saved, request);
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        EstadoEntity entity = estadoRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Estado no encontrado"));
        estadoRepository.delete(entity);
    }

    private void applyUpsert(EstadoEntity entity, EstadoUpsertRequest request) {
        entity.setNombre(requiredTrimmed(request.name(), "El nombre del estado es obligatorio"));
        entity.setTipo(requiredTrimmed(request.type(), "El tipo del estado es obligatorio"));

        entity.setDescripcion(normalizedOrEmpty(request.description()));
        entity.setHistoria(normalizedOrEmpty(request.history()));
        entity.setGobiernoTipo(normalizedOrEmpty(request.governmentType()));

        Long imagenAssetId = request.imageAssetId();
        if (imagenAssetId != null && imagenAssetId > 0) {
            entity.setImagenAsset(resolveImageAsset(imagenAssetId));
            entity.setImagen(null);
        } else {
            entity.setImagenAsset(null);
            entity.setImagen(optionalTrimmed(request.image()));
        }

        Long territorioImagenAssetId = request.territoryImageAssetId();
        if (territorioImagenAssetId != null && territorioImagenAssetId > 0) {
            entity.setTerritorioImagenAsset(resolveImageAsset(territorioImagenAssetId));
            entity.setTerritorioImagen(null);
        } else {
            entity.setTerritorioImagenAsset(null);
            entity.setTerritorioImagen(optionalTrimmed(request.territoryImage()));
        }

        entity.setEstadoPadre(resolveEstadoPadre(request.parentStateId(), entity.getId()));
    }

    private void syncChildren(EstadoEntity estado, EstadoUpsertRequest request) {
        Long estadoId = estado.getId();

        estadoMemberRepository.deleteByEstado_Id(estadoId);
        estadoLandmarkRoleRepository.deleteByEstado_Id(estadoId);
        estadoMemberRepository.flush();
        estadoLandmarkRoleRepository.flush();

        List<EstadoMemberDto> miembros = request.members() == null ? List.of() : request.members();
        Set<Long> requestedCharacterIds = new LinkedHashSet<>();
        for (EstadoMemberDto member : miembros) {
            if (member == null || member.characterId() == null) continue;
            requestedCharacterIds.add(member.characterId());
        }

        Map<Long, CharacterEntity> charactersById = characterRepository.findAllById(requestedCharacterIds)
            .stream().collect(Collectors.toMap(CharacterEntity::getId, value -> value));
        if (charactersById.size() != requestedCharacterIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "members contiene characterId invalido");
        }

        for (EstadoMemberDto member : miembros) {
            if (member == null || member.characterId() == null) continue;
            CharacterEntity character = charactersById.get(member.characterId());
            if (character == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "members contiene characterId invalido");
            }
            EstadoMemberEntity item = new EstadoMemberEntity();
            item.setEstado(estado);
            item.setCharacter(character);
            item.setRol(normalizedOrEmpty(member.role()));
            estadoMemberRepository.save(item);
        }

        List<EstadoLandmarkRoleDto> landmarkRoles = request.landmarks() == null ? List.of() : request.landmarks();
        Set<Long> requestedLandmarkIds = new LinkedHashSet<>();
        for (EstadoLandmarkRoleDto role : landmarkRoles) {
            if (role == null || role.landmarkId() == null) continue;
            requestedLandmarkIds.add(role.landmarkId());
        }

        Map<Long, LandmarkEntity> landmarksById = landmarkRepository.findAllById(requestedLandmarkIds)
            .stream().collect(Collectors.toMap(LandmarkEntity::getId, value -> value));
        if (landmarksById.size() != requestedLandmarkIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarks contiene ids invalidos");
        }

        for (EstadoLandmarkRoleDto role : landmarkRoles) {
            if (role == null || role.landmarkId() == null) continue;
            LandmarkEntity landmark = landmarksById.get(role.landmarkId());
            if (landmark == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarks contiene ids invalidos");
            }
            EstadoLandmarkRoleEntity item = new EstadoLandmarkRoleEntity();
            item.setEstado(estado);
            item.setLandmark(landmark);
            item.setRol(normalizedOrEmpty(role.role()));
            estadoLandmarkRoleRepository.save(item);
        }
    }

    private EstadoDto toDto(EstadoEntity entity) {
        Long estadoId = entity.getId();
        Long imagenAssetId = entity.getImagenAsset() != null ? entity.getImagenAsset().getId() : null;
        Long territorioImagenAssetId = entity.getTerritorioImagenAsset() != null ? entity.getTerritorioImagenAsset().getId() : null;
        Long estadoPadreId = entity.getEstadoPadre() != null ? entity.getEstadoPadre().getId() : null;

        List<EstadoMemberDto> miembros = estadoMemberRepository.findByEstado_IdOrderByIdAsc(estadoId)
            .stream()
            .map((item) -> new EstadoMemberDto(item.getCharacter().getId(), item.getRol()))
            .toList();

        List<EstadoLandmarkRoleDto> landmarks = estadoLandmarkRoleRepository.findByEstado_IdOrderByIdAsc(estadoId)
            .stream()
            .map((item) -> new EstadoLandmarkRoleDto(item.getLandmark().getId(), item.getRol()))
            .toList();

        return new EstadoDto(
            entity.getId(),
            entity.getNombre(),
            entity.getTipo(),
            entity.getDescripcion(),
            entity.getHistoria(),
            entity.getGobiernoTipo(),
            entity.getImagen(),
            imagenAssetId,
            entity.getTerritorioImagen(),
            territorioImagenAssetId,
            estadoPadreId,
            miembros,
            landmarks
        );
    }

    private EstadoEntity resolveEstadoPadre(Long estadoPadreId, Long estadoId) {
        if (estadoPadreId == null || estadoPadreId <= 0) {
            return null;
        }
        if (estadoId != null && estadoId.equals(estadoPadreId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un estado no puede ser subdivision de si mismo");
        }
        EstadoEntity estadoPadre = estadoRepository.findById(estadoPadreId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentStateId invalido"));
        if (estadoId != null && isDescendantOf(estadoPadre, estadoId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un estado no puede ser subdivision de una subdivision propia");
        }
        return estadoPadre;
    }

    private boolean isDescendantOf(EstadoEntity entity, Long possibleAncestorId) {
        EstadoEntity current = entity;
        while (current != null) {
            if (possibleAncestorId.equals(current.getId())) {
                return true;
            }
            current = current.getEstadoPadre();
        }
        return false;
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

    private MediaAssetEntity resolveImageAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "imagenAssetId debe apuntar a un asset de imagen");
        }
        return asset;
    }
}
