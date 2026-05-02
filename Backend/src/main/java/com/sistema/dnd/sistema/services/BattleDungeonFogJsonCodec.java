package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.BattleDungeonFogData;
import org.springframework.stereotype.Component;

@Component
public class BattleDungeonFogJsonCodec {

    private final ObjectMapper objectMapper;

    public BattleDungeonFogJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(BattleDungeonFogData value) {
        try {
            return objectMapper.writeValueAsString(value == null ? defaultValue() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo serializar la niebla de dungeon", exception);
        }
    }

    public BattleDungeonFogData read(String value) {
        if (value == null || value.isBlank()) {
            return defaultValue();
        }

        try {
            return objectMapper.readValue(value, BattleDungeonFogData.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo deserializar la niebla de dungeon", exception);
        }
    }

    private BattleDungeonFogData defaultValue() {
        return new BattleDungeonFogData(false, java.util.List.of(), 4, 8);
    }
}
