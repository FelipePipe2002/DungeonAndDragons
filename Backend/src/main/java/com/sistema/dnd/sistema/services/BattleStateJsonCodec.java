package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.BattleTokenData;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BattleStateJsonCodec {

    private static final TypeReference<List<BattleTokenData>> TOKEN_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public BattleStateJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(List<BattleTokenData> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo serializar el estado de batalla", exception);
        }
    }

    public List<BattleTokenData> read(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(value, TOKEN_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudo deserializar el estado de batalla", exception);
        }
    }
}
