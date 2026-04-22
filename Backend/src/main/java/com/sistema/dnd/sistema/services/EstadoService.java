package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.EstadoDto;
import com.sistema.dnd.sistema.dto.domain.EstadoLandmarkRoleDto;
import com.sistema.dnd.sistema.dto.domain.EstadoLandmarkRoleRequest;
import com.sistema.dnd.sistema.dto.domain.EstadoMemberDto;
import com.sistema.dnd.sistema.dto.domain.EstadoMemberRequest;
import com.sistema.dnd.sistema.dto.domain.EstadoUpsertRequest;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.EstadoEntity;
import com.sistema.dnd.sistema.entity.EstadoLandmarkRoleEntity;
import com.sistema.dnd.sistema.entity.EstadoMemberEntity;
import com.sistema.dnd.sistema.entity.EstadoSubdivisionNameEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.EstadoRepository;
import com.sistema.dnd.sistema.repository.EstadoLandmarkRoleRepository;
import com.sistema.dnd.sistema.repository.EstadoMemberRepository;
import com.sistema.dnd.sistema.repository.EstadoSubdivisionNameRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import jakarta.transaction.Transactional;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EstadoService {

    private final EstadoRepository estadoRepository;
    private final EstadoMemberRepository estadoMemberRepository;
    private final EstadoLandmarkRoleRepository estadoLandmarkRoleRepository;
    private final EstadoSubdivisionNameRepository estadoSubdivisionNameRepository;
    private final CharacterRepository characterRepository;
    private final LandmarkRepository landmarkRepository;
    private final MediaAssetRepository mediaAssetRepository;

    public EstadoService(
        EstadoRepository estadoRepository,
        EstadoMemberRepository estadoMemberRepository,
        EstadoLandmarkRoleRepository estadoLandmarkRoleRepository,
        EstadoSubdivisionNameRepository estadoSubdivisionNameRepository,
        CharacterRepository characterRepository,
        LandmarkRepository landmarkRepository,
        MediaAssetRepository mediaAssetRepository
    ) {
        this.estadoRepository = estadoRepository;
        this.estadoMemberRepository = estadoMemberRepository;
        this.estadoLandmarkRoleRepository = estadoLandmarkRoleRepository;
        this.estadoSubdivisionNameRepository = estadoSubdivisionNameRepository;
        this.characterRepository = characterRepository;
        this.landmarkRepository = landmarkRepository;
        this.mediaAssetRepository = mediaAssetRepository;
    }

    public List<EstadoDto> findAll() {
        return estadoRepository.findAll(Sort.by(Sort.Direction.ASC, "nombre"))
            .stream()
            .map(this::toDto)
            .toList();
    }

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
        entity.setNombre(requiredTrimmed(request.nombre(), "El nombre del estado es obligatorio"));
        entity.setTipo(requiredTrimmed(request.tipo(), "El tipo del estado es obligatorio"));

        entity.setDescripcion(normalizedOrEmpty(request.descripcion()));
        entity.setHistoria(normalizedOrEmpty(request.historia()));
        entity.setGobiernoTipo(normalizedOrEmpty(request.gobiernoTipo()));

        Long imagenAssetId = request.imagenAssetId();
        if (imagenAssetId != null && imagenAssetId > 0) {
            entity.setImagenAsset(resolveImageAsset(imagenAssetId));
            entity.setImagen(null);
        } else {
            entity.setImagenAsset(null);
            entity.setImagen(optionalTrimmed(request.imagen()));
        }

        Long territorioImagenAssetId = request.territorioImagenAssetId();
        if (territorioImagenAssetId != null && territorioImagenAssetId > 0) {
            entity.setTerritorioImagenAsset(resolveImageAsset(territorioImagenAssetId));
            entity.setTerritorioImagen(null);
        } else {
            entity.setTerritorioImagenAsset(null);
            entity.setTerritorioImagen(optionalTrimmed(request.territorioImagen()));
        }

        entity.setEstadoPadre(resolveEstadoPadre(request.estadoPadreId(), entity.getId()));
    }

    private void syncChildren(EstadoEntity estado, EstadoUpsertRequest request) {
        Long estadoId = estado.getId();

        estadoMemberRepository.deleteByEstado_Id(estadoId);
        estadoLandmarkRoleRepository.deleteByEstado_Id(estadoId);
        estadoSubdivisionNameRepository.deleteByEstado_Id(estadoId);
        estadoMemberRepository.flush();
        estadoLandmarkRoleRepository.flush();

        List<EstadoMemberRequest> miembros = request.miembros() == null ? List.of() : request.miembros();
        Set<Long> requestedCharacterIds = new LinkedHashSet<>();
        for (EstadoMemberRequest member : miembros) {
            if (member == null || member.personajeId() == null) continue;
            requestedCharacterIds.add(member.personajeId());
        }

        Map<Long, CharacterEntity> charactersById = characterRepository.findAllById(requestedCharacterIds)
            .stream().collect(Collectors.toMap(CharacterEntity::getId, value -> value));
        if (charactersById.size() != requestedCharacterIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "miembros contiene personajeId invalido");
        }

        for (EstadoMemberRequest member : miembros) {
            if (member == null || member.personajeId() == null) continue;
            CharacterEntity character = charactersById.get(member.personajeId());
            if (character == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "miembros contiene personajeId invalido");
            }
            EstadoMemberEntity item = new EstadoMemberEntity();
            item.setEstado(estado);
            item.setCharacter(character);
            item.setRol(normalizedOrEmpty(member.rol()));
            estadoMemberRepository.save(item);
        }

        List<EstadoLandmarkRoleRequest> landmarkRoles = request.landmarks() == null ? List.of() : request.landmarks();
        Set<Long> requestedLandmarkIds = new LinkedHashSet<>();
        for (EstadoLandmarkRoleRequest role : landmarkRoles) {
            if (role == null || role.landmarkId() == null) continue;
            requestedLandmarkIds.add(role.landmarkId());
        }

        Map<Long, LandmarkEntity> landmarksById = landmarkRepository.findAllById(requestedLandmarkIds)
            .stream().collect(Collectors.toMap(LandmarkEntity::getId, value -> value));
        if (landmarksById.size() != requestedLandmarkIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarks contiene ids invalidos");
        }

        for (EstadoLandmarkRoleRequest role : landmarkRoles) {
            if (role == null || role.landmarkId() == null) continue;
            LandmarkEntity landmark = landmarksById.get(role.landmarkId());
            if (landmark == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarks contiene ids invalidos");
            }
            EstadoLandmarkRoleEntity item = new EstadoLandmarkRoleEntity();
            item.setEstado(estado);
            item.setLandmark(landmark);
            item.setRol(normalizedOrEmpty(role.rol()));
            estadoLandmarkRoleRepository.save(item);
        }

        Set<String> uniqueSubdivisionNames = new LinkedHashSet<>();
        List<String> subdivisiones = request.subdivisiones() == null ? List.of() : request.subdivisiones();
        for (String subdivisionName : subdivisiones) {
            String normalized = optionalTrimmed(subdivisionName);
            if (normalized != null) uniqueSubdivisionNames.add(normalized);
        }

        for (String subdivisionName : uniqueSubdivisionNames) {
            EstadoSubdivisionNameEntity item = new EstadoSubdivisionNameEntity();
            item.setEstado(estado);
            item.setNombre(subdivisionName);
            estadoSubdivisionNameRepository.save(item);
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

        List<String> subdivisiones = estadoSubdivisionNameRepository.findByEstado_IdOrderByIdAsc(estadoId)
            .stream()
            .map(EstadoSubdivisionNameEntity::getNombre)
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
            landmarks,
            subdivisiones
        );
    }

    private EstadoEntity resolveEstadoPadre(Long estadoPadreId, Long estadoId) {
        if (estadoPadreId == null || estadoPadreId <= 0) {
            return null;
        }
        if (estadoId != null && estadoId.equals(estadoPadreId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un estado no puede ser subdivision de si mismo");
        }
        return estadoRepository.findById(estadoPadreId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "estadoPadreId invalido"));
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
