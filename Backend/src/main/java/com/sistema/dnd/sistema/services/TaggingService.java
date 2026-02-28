package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.entity.TagEntity;
import com.sistema.dnd.sistema.entity.TaggableEntityType;
import com.sistema.dnd.sistema.entity.TaggingEntity;
import com.sistema.dnd.sistema.repository.TagRepository;
import com.sistema.dnd.sistema.repository.TaggingRepository;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class TaggingService {

    private final TagRepository tagRepository;
    private final TaggingRepository taggingRepository;

    public TaggingService(TagRepository tagRepository, TaggingRepository taggingRepository) {
        this.tagRepository = tagRepository;
        this.taggingRepository = taggingRepository;
    }

    public List<String> findTagNames(TaggableEntityType entityType, Long entityId) {
        return taggingRepository.findTagNamesByEntity(entityType, entityId);
    }

    public void replaceTags(TaggableEntityType entityType, Long entityId, List<String> tags) {
        taggingRepository.deleteByEntityTypeAndEntityId(entityType, entityId);
        taggingRepository.flush();

        for (String tagName : dedupeStrings(tags)) {
            TagEntity tag = getOrCreateTag(tagName);
            TaggingEntity tagging = new TaggingEntity();
            tagging.setTag(tag);
            tagging.setEntityType(entityType);
            tagging.setEntityId(entityId);
            taggingRepository.save(tagging);
        }
    }

    private TagEntity getOrCreateTag(String tagName) {
        String normalizedTagName = normalizeTagName(tagName);
        TagEntity existing = tagRepository.findByNombre(normalizedTagName);
        if (existing == null) {
            existing = tagRepository.findByNombreIgnoreCase(normalizedTagName);
        }
        if (existing != null) {
            return existing;
        }

        TagEntity created = new TagEntity();
        created.setNombre(normalizedTagName);
        try {
            return tagRepository.save(created);
        } catch (DataIntegrityViolationException ex) {
            TagEntity concurrent = tagRepository.findByNombre(normalizedTagName);
            if (concurrent == null) {
                concurrent = tagRepository.findByNombreIgnoreCase(normalizedTagName);
            }
            if (concurrent != null) {
                return concurrent;
            }
            throw ex;
        }
    }

    private List<String> dedupeStrings(List<String> values) {
        if (values == null || values.isEmpty()) return List.of();
        Set<String> result = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null) continue;
            String normalized = normalizeTagName(value);
            if (!normalized.isEmpty()) result.add(normalized);
        }
        return result.stream().toList();
    }

    private String normalizeTagName(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
