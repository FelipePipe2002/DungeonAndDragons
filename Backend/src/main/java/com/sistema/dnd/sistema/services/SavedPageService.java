package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.SavedPageDto;
import com.sistema.dnd.sistema.entity.SavedPageEntity;
import com.sistema.dnd.sistema.repository.SavedPageRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SavedPageService {

    private final SavedPageRepository savedPageRepository;

    public SavedPageService(SavedPageRepository savedPageRepository) {
        this.savedPageRepository = savedPageRepository;
    }

    public List<SavedPageDto> findAll() {
        return savedPageRepository.findAllByOrderByTituloAsc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public SavedPageDto create(SavedPageDto request) {
        SavedPageEntity entity = new SavedPageEntity();
        applyUpsert(entity, request);
        return toDto(savedPageRepository.save(entity));
    }

    @Transactional
    public SavedPageDto update(Long id, SavedPageDto request) {
        SavedPageEntity entity = savedPageRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pagina no encontrada"));

        applyUpsert(entity, request);
        return toDto(savedPageRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        SavedPageEntity entity = savedPageRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pagina no encontrada"));

        savedPageRepository.delete(entity);
    }

    private void applyUpsert(SavedPageEntity entity, SavedPageDto request) {
        entity.setTitulo(requiredTrimmed(request.title(), "El titulo es obligatorio"));
        entity.setUrl(requiredUrl(request.url()));
        entity.setSelector(normalizedOrNull(request.selector()));
    }

    private SavedPageDto toDto(SavedPageEntity entity) {
        return new SavedPageDto(
            entity.getId(),
            entity.getTitulo(),
            entity.getUrl(),
            entity.getSelector()
        );
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String requiredUrl(String value) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La URL es obligatoria");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La URL es obligatoria");
        }
        if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La URL debe comenzar con http:// o https://");
        }
        return trimmed;
    }

    private String normalizedOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
