package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.BattleObstacleData;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BattleObstacleJsonCodec {

    private static final TypeReference<List<BattleObstacleData>> OBSTACLE_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    public BattleObstacleJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String write(List<BattleObstacleData> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? List.of() : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudieron serializar los obstaculos de batalla", exception);
        }
    }

    public List<BattleObstacleData> read(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        try {
            return objectMapper.readValue(value, OBSTACLE_LIST_TYPE);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("No se pudieron deserializar los obstaculos de batalla", exception);
        }
    }
}
