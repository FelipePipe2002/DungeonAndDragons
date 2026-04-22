package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.SubdivisionDto;
import com.sistema.dnd.sistema.dto.domain.SubdivisionUpsertRequest;
import com.sistema.dnd.sistema.entity.EstadoEntity;
import com.sistema.dnd.sistema.entity.SubdivisionEntity;
import com.sistema.dnd.sistema.repository.EstadoRepository;
import com.sistema.dnd.sistema.repository.SubdivisionRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SubdivisionService {

    private final SubdivisionRepository subdivisionRepository;
    private final EstadoRepository estadoRepository;

    public SubdivisionService(SubdivisionRepository subdivisionRepository, EstadoRepository estadoRepository) {
        this.subdivisionRepository = subdivisionRepository;
        this.estadoRepository = estadoRepository;
    }

    public List<SubdivisionDto> findAll(Long estadoId) {
        if (estadoId != null && estadoId > 0) {
            return subdivisionRepository.findByEstado_IdOrderByNombreAsc(estadoId).stream().map(this::toDto).toList();
        }
        return subdivisionRepository.findAll().stream().map(this::toDto).toList();
    }

    public SubdivisionDto findById(Long id) {
        SubdivisionEntity entity = subdivisionRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subdivision no encontrada"));
        return toDto(entity);
    }

    public SubdivisionDto create(SubdivisionUpsertRequest request) {
        SubdivisionEntity entity = new SubdivisionEntity();
        applyUpsert(entity, request);
        return toDto(subdivisionRepository.save(entity));
    }

    public SubdivisionDto update(Long id, SubdivisionUpsertRequest request) {
        SubdivisionEntity entity = subdivisionRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subdivision no encontrada"));
        applyUpsert(entity, request);
        return toDto(subdivisionRepository.save(entity));
    }

    public void delete(Long id) {
        SubdivisionEntity entity = subdivisionRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subdivision no encontrada"));
        subdivisionRepository.delete(entity);
    }

    private void applyUpsert(SubdivisionEntity entity, SubdivisionUpsertRequest request) {
        if (request.estadoId() == null || request.estadoId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "estadoId invalido");
        }
        EstadoEntity estado = estadoRepository.findById(request.estadoId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "estadoId invalido"));

        entity.setEstado(estado);
        entity.setNombre(requiredTrimmed(request.nombre(), "El nombre de la subdivision es obligatorio"));
        entity.setTipo(requiredTrimmed(request.tipo(), "El tipo de la subdivision es obligatorio"));
    }

    private SubdivisionDto toDto(SubdivisionEntity entity) {
        Long estadoId = entity.getEstado() != null ? entity.getEstado().getId() : null;
        return new SubdivisionDto(entity.getId(), estadoId, entity.getNombre(), entity.getTipo());
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }
}
