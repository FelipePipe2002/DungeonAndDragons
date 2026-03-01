package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.CharacterSheetData;
import org.springframework.stereotype.Component;

@Component
public class CharacterSheetJsonCodec {

    private final ObjectMapper objectMapper;

    public CharacterSheetJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(CharacterSheetData value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo serializar el characterSheet", exception);
        }
    }

    public CharacterSheetData read(String value) {
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
