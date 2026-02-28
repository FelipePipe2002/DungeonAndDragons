package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.DmNotesDto;
import com.sistema.dnd.sistema.dto.domain.DmNotesUpsertRequest;
import com.sistema.dnd.sistema.entity.DmNotesEntity;
import com.sistema.dnd.sistema.repository.DmNotesRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class DmNotesService {

    private static final long SINGLETON_ID = 1L;

    private final DmNotesRepository dmNotesRepository;

    public DmNotesService(DmNotesRepository dmNotesRepository) {
        this.dmNotesRepository = dmNotesRepository;
    }

    @Transactional
    public DmNotesDto find() {
        return toDto(getOrCreateSingleton());
    }

    @Transactional
    public DmNotesDto update(DmNotesUpsertRequest request) {
        DmNotesEntity entity = getOrCreateSingleton();
        entity.setTexto(normalizedOrEmpty(request.texto()));
        return toDto(dmNotesRepository.save(entity));
    }

    private DmNotesEntity getOrCreateSingleton() {
        return dmNotesRepository.findById(SINGLETON_ID)
            .orElseGet(() -> {
                DmNotesEntity entity = new DmNotesEntity();
                entity.setId(SINGLETON_ID);
                entity.setTexto("");
                return dmNotesRepository.save(entity);
            });
    }

    private DmNotesDto toDto(DmNotesEntity entity) {
        return new DmNotesDto(normalizedOrEmpty(entity.getTexto()));
    }

    private String normalizedOrEmpty(String value) {
        if (value == null) return "";
        return value;
    }
}
