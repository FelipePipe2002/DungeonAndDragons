package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BattleObstacleData;
import com.sistema.dnd.sistema.dto.domain.BattleStateDto;
import com.sistema.dnd.sistema.dto.domain.BattleStateUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.BattleTokenData;
import com.sistema.dnd.sistema.entity.BattleStateEntity;
import com.sistema.dnd.sistema.repository.BattleStateRepository;
import jakarta.transaction.Transactional;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class BattleStateService {

    private static final String ACTIVE_BATTLE_SLUG = "active";

    private final BattleStateRepository battleStateRepository;
    private final BattleStateJsonCodec battleStateJsonCodec;
    private final BattleObstacleJsonCodec battleObstacleJsonCodec;

    public BattleStateService(
        BattleStateRepository battleStateRepository,
        BattleStateJsonCodec battleStateJsonCodec,
        BattleObstacleJsonCodec battleObstacleJsonCodec
    ) {
        this.battleStateRepository = battleStateRepository;
        this.battleStateJsonCodec = battleStateJsonCodec;
        this.battleObstacleJsonCodec = battleObstacleJsonCodec;
    }

    public BattleStateDto findCurrent() {
        return battleStateRepository.findBySlug(ACTIVE_BATTLE_SLUG)
            .map(this::toDto)
            .orElseGet(this::emptyState);
    }

    @Transactional
    public BattleStateDto updateCurrent(BattleStateUpsertRequest request) {
        BattleStateEntity entity = battleStateRepository.findBySlug(ACTIVE_BATTLE_SLUG)
            .orElseGet(() -> {
                BattleStateEntity created = new BattleStateEntity();
                created.setSlug(ACTIVE_BATTLE_SLUG);
                return created;
            });

        List<BattleTokenData> normalizedTokens = normalizeTokens(request == null ? null : request.tokens());
        List<BattleObstacleData> normalizedObstacles = normalizeObstacles(request == null ? null : request.obstacles());
        entity.setLandmarkSlug(normalizedOrNull(request == null ? null : request.landmarkSlug()));
        entity.setNextTokenNumber(resolveNextTokenNumber(request == null ? null : request.nextTokenNumber(), normalizedTokens));
        entity.setTokensJson(battleStateJsonCodec.write(normalizedTokens));
        entity.setNextObstacleId(resolveNextObstacleId(request == null ? null : request.nextObstacleId(), normalizedObstacles));
        entity.setObstaclesJson(battleObstacleJsonCodec.write(normalizedObstacles));

        return toDto(battleStateRepository.save(entity));
    }

    private BattleStateDto emptyState() {
        return new BattleStateDto(null, ACTIVE_BATTLE_SLUG, null, 1, List.of(), 1, List.of());
    }

    private BattleStateDto toDto(BattleStateEntity entity) {
        List<BattleTokenData> tokens = normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()));
        List<BattleObstacleData> obstacles = normalizeObstacles(battleObstacleJsonCodec.read(entity.getObstaclesJson()));

        return new BattleStateDto(
            entity.getId(),
            entity.getSlug(),
            normalizedOrNull(entity.getLandmarkSlug()),
            resolveNextTokenNumber(entity.getNextTokenNumber(), tokens),
            tokens,
            resolveNextObstacleId(entity.getNextObstacleId(), obstacles),
            obstacles
        );
    }

    private List<BattleTokenData> normalizeTokens(List<BattleTokenData> tokens) {
        if (tokens == null) {
            return List.of();
        }

        return tokens.stream()
            .filter(Objects::nonNull)
            .map(this::normalizeToken)
            .sorted(Comparator.comparing(BattleTokenData::number))
            .collect(Collectors.toList());
    }

    private List<BattleObstacleData> normalizeObstacles(List<BattleObstacleData> obstacles) {
        if (obstacles == null) {
            return List.of();
        }

        return obstacles.stream()
            .filter(Objects::nonNull)
            .map(this::normalizeObstacle)
            .sorted(Comparator.comparing(BattleObstacleData::id))
            .collect(Collectors.toList());
    }

    private BattleTokenData normalizeToken(BattleTokenData token) {
        int number = positiveInt(token.number(), 1);
        String type = normalizeTokenType(token.type());
        String nombre = normalizedOrNull(token.nombre());
        if (nombre == null) {
            nombre = "%s %d".formatted(type.equals("player") ? "Jugador" : "Enemigo", number);
        }

        Integer life = type.equals("enemy") ? optionalInt(token.life()) : null;

        return new BattleTokenData(
            number,
            trimToLength(nombre, 120),
            type,
            clampPercent(token.x(), 50),
            clampPercent(token.y(), 50),
            optionalInt(token.initiative()),
            life,
            clampTokenSize(token.size(), 1),
            trimToLength(normalizedOrNull(token.status()), 200)
        );
    }

    private BattleObstacleData normalizeObstacle(BattleObstacleData obstacle) {
        int id = positiveInt(obstacle.id(), 1);
        String shape = normalizeObstacleShape(obstacle.shape());
        double width = clampObstacleDimension(obstacle.width(), shape.equals("circle") ? 8 : 14);
        double height = shape.equals("circle") ? width : clampObstacleDimension(obstacle.height(), 8);

        return new BattleObstacleData(
            id,
            shape,
            clampPercent(obstacle.x(), 50),
            clampPercent(obstacle.y(), 50),
            width,
            height,
            normalizeHexColor(obstacle.color(), shape.equals("circle") ? "#f59e0b" : "#0f766e")
        );
    }

    private int resolveNextTokenNumber(Integer requestedNextTokenNumber, List<BattleTokenData> tokens) {
        int maxTokenNumber = tokens.stream()
            .map(BattleTokenData::number)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .max()
            .orElse(0);

        int normalizedRequested = positiveInt(requestedNextTokenNumber, 1);
        return Math.max(normalizedRequested, maxTokenNumber + 1);
    }

    private int resolveNextObstacleId(Integer requestedNextObstacleId, List<BattleObstacleData> obstacles) {
        int maxObstacleId = obstacles.stream()
            .map(BattleObstacleData::id)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .max()
            .orElse(0);

        int normalizedRequested = positiveInt(requestedNextObstacleId, 1);
        return Math.max(normalizedRequested, maxObstacleId + 1);
    }

    private String normalizeTokenType(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return "enemy";
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        return lowered.equals("player") ? "player" : "enemy";
    }

    private String normalizeObstacleShape(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return "rectangle";
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        return lowered.equals("circle") ? "circle" : "rectangle";
    }

    private String normalizedOrNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trimToLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }

        return value.length() <= maxLength ? value : value.substring(0, maxLength).trim();
    }

    private Double clampPercent(Double value, double fallback) {
        if (value == null || !Double.isFinite(value)) {
            return fallback;
        }

        return Math.max(0, Math.min(100, value));
    }

    private Integer optionalInt(Integer value) {
        if (value == null) {
            return null;
        }
        return value;
    }

    private Double clampTokenSize(Double value, double fallback) {
        if (value == null || !Double.isFinite(value)) {
            return fallback;
        }

        return Math.max(0.4, Math.min(2, value));
    }

    private Double clampObstacleDimension(Double value, double fallback) {
        if (value == null || !Double.isFinite(value)) {
            return fallback;
        }

        return Math.max(1, Math.min(100, value));
    }

    private String normalizeHexColor(String value, String fallback) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return fallback;
        }

        String candidate = normalized.toLowerCase(Locale.ROOT);
        if (candidate.matches("^#[0-9a-f]{6}$")) {
            return candidate;
        }

        return fallback;
    }

    private int positiveInt(Integer value, int fallback) {
        if (value == null || value < 1) {
            return fallback;
        }
        return value;
    }
}
