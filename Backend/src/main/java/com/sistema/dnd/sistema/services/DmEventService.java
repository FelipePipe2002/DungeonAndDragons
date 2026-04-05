package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.DmEventDto;
import com.sistema.dnd.sistema.dto.domain.DmEventUpsertRequest;
import com.sistema.dnd.sistema.entity.DmEventEntity;
import com.sistema.dnd.sistema.repository.DmEventRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DmEventService {

    private final DmEventRepository dmEventRepository;

    public DmEventService(DmEventRepository dmEventRepository) {
        this.dmEventRepository = dmEventRepository;
    }

    public List<DmEventDto> findAll() {
        return dmEventRepository.findAllByOrderByCreatedAtDescIdDesc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public DmEventDto create(DmEventUpsertRequest request) {
        DmEventEntity entity = new DmEventEntity();
        entity.setTitulo(normalizedOrNull(request.titulo()));
        entity.setDescripcion(requiredTrimmed(request.descripcion(), "La descripcion del evento es obligatoria"));
        return toDto(dmEventRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        DmEventEntity entity = dmEventRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evento no encontrado"));

        dmEventRepository.delete(entity);
    }

    private DmEventDto toDto(DmEventEntity entity) {
        return new DmEventDto(
            entity.getId(),
            entity.getTitulo(),
            entity.getDescripcion(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizedOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
