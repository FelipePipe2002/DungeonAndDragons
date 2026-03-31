package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.BattleFogRevealData;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BattleFogRevealJsonCodec {

    private static final TypeReference<List<BattleFogRevealData>> FOG_REVEAL_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public BattleFogRevealJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(List<BattleFogRevealData> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudieron serializar las zonas de niebla", exception);
        }
    }

    public List<BattleFogRevealData> read(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(value, FOG_REVEAL_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudieron deserializar las zonas de niebla", exception);
        }
    }
}
