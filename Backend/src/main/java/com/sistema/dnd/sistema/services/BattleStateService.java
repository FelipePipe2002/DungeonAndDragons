package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BattleObstacleData;
import com.sistema.dnd.sistema.dto.domain.BattleStateDto;
import com.sistema.dnd.sistema.dto.domain.BattleStateUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.BattleSummaryDto;
import com.sistema.dnd.sistema.dto.domain.BattleTokenData;
import com.sistema.dnd.sistema.dto.domain.CreateBattleRequest;
import com.sistema.dnd.sistema.dto.domain.UpdateBattleStateRequest;
import com.sistema.dnd.sistema.entity.BattleStateEntity;
import com.sistema.dnd.sistema.entity.BattleStatus;
import com.sistema.dnd.sistema.repository.BattleStateRepository;
import jakarta.transaction.Transactional;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BattleStateService {

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
        throw new ResponseStatusException(HttpStatus.GONE, "Usa /v1/battles");
    }

    public BattleStateDto updateCurrent(BattleStateUpsertRequest request) {
        throw new ResponseStatusException(HttpStatus.GONE, "Usa /v1/battles/{id}");
    }

    public BattleStateDto findById(Long id) {
        return toDto(requireBattle(id));
    }

    public BattleStateDto findActiveByLandmark(String landmarkSlug) {
        String normalizedLandmarkSlug = requireLandmarkSlug(landmarkSlug);

        return battleStateRepository
            .findFirstByLandmarkSlugAndStatusOrderByUpdatedAtDesc(normalizedLandmarkSlug, BattleStatus.ACTIVE)
            .map(this::toDto)
            .orElse(null);
    }

    public List<BattleSummaryDto> findHistoryByLandmark(String landmarkSlug) {
        String normalizedLandmarkSlug = requireLandmarkSlug(landmarkSlug);

        return battleStateRepository.findByLandmarkSlugOrderByUpdatedAtDesc(normalizedLandmarkSlug).stream()
            .sorted(historyComparator())
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    @Transactional
    public BattleStateDto create(CreateBattleRequest request) {
        String landmarkSlug = requireLandmarkSlug(request == null ? null : request.landmarkSlug());

        battleStateRepository.findFirstByLandmarkSlugAndStatusOrderByUpdatedAtDesc(landmarkSlug, BattleStatus.ACTIVE)
            .ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una batalla activa para este landmark");
            });

        BattleStateEntity entity = new BattleStateEntity();
        entity.setSlug(buildBattleSlug());
        entity.setLandmarkSlug(landmarkSlug);
        entity.setStatus(BattleStatus.ACTIVE);
        entity.setEndedAt(null);
        entity.setNextTokenNumber(1);
        entity.setCurrentTurnTokenNumber(null);
        entity.setTokensJson("[]");
        entity.setNextObstacleId(1);
        entity.setObstaclesJson("[]");

        return toDto(battleStateRepository.save(entity));
    }

    @Transactional
    public BattleStateDto update(Long id, UpdateBattleStateRequest request) {
        BattleStateEntity entity = requireBattle(id);
        ensureEditable(entity);

        List<BattleTokenData> normalizedTokens = normalizeTokens(request == null ? null : request.tokens());
        List<BattleObstacleData> normalizedObstacles = normalizeObstacles(request == null ? null : request.obstacles());
        Integer normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(
            request == null ? null : request.currentTurnTokenNumber(),
            normalizedTokens
        );

        entity.setNextTokenNumber(resolveNextTokenNumber(request == null ? null : request.nextTokenNumber(), normalizedTokens));
        entity.setCurrentTurnTokenNumber(normalizedCurrentTurnTokenNumber);
        entity.setTokensJson(battleStateJsonCodec.write(normalizedTokens));
        entity.setNextObstacleId(resolveNextObstacleId(request == null ? null : request.nextObstacleId(), normalizedObstacles));
        entity.setObstaclesJson(battleObstacleJsonCodec.write(normalizedObstacles));
        entity.setEndedAt(null);

        return toDto(battleStateRepository.save(entity));
    }

    @Transactional
    public BattleStateDto finish(Long id) {
        BattleStateEntity entity = requireBattle(id);

        if (effectiveStatus(entity) == BattleStatus.FINISHED) {
            return toDto(entity);
        }

        entity.setStatus(BattleStatus.FINISHED);
        entity.setEndedAt(OffsetDateTime.now());
        return toDto(battleStateRepository.save(entity));
    }

    @Transactional
    public BattleStateDto reopen(Long id) {
        BattleStateEntity entity = requireBattle(id);
        String landmarkSlug = requireLandmarkSlug(entity.getLandmarkSlug());

        battleStateRepository.findFirstByLandmarkSlugAndStatusOrderByUpdatedAtDesc(landmarkSlug, BattleStatus.ACTIVE)
            .ifPresent(activeBattle -> {
                if (!Objects.equals(activeBattle.getId(), entity.getId())) {
                    activeBattle.setStatus(BattleStatus.FINISHED);
                    activeBattle.setEndedAt(OffsetDateTime.now());
                    battleStateRepository.save(activeBattle);
                }
            });

        entity.setStatus(BattleStatus.ACTIVE);
        entity.setEndedAt(null);
        entity.setCurrentTurnTokenNumber(
            normalizeCurrentTurnTokenNumber(
                entity.getCurrentTurnTokenNumber(),
                normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()))
            )
        );

        return toDto(battleStateRepository.save(entity));
    }

    private BattleStateEntity requireBattle(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id invalido");
        }

        return battleStateRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batalla no encontrada"));
    }

    private void ensureEditable(BattleStateEntity entity) {
        if (effectiveStatus(entity) != BattleStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La batalla esta terminada");
        }
    }

    private Comparator<BattleStateEntity> historyComparator() {
        return (left, right) -> {
            boolean leftIsActive = effectiveStatus(left) == BattleStatus.ACTIVE;
            boolean rightIsActive = effectiveStatus(right) == BattleStatus.ACTIVE;
            if (leftIsActive != rightIsActive) {
                return leftIsActive ? -1 : 1;
            }

            OffsetDateTime leftUpdatedAt = left.getUpdatedAt();
            OffsetDateTime rightUpdatedAt = right.getUpdatedAt();
            if (leftUpdatedAt == null && rightUpdatedAt == null) {
                return 0;
            }
            if (leftUpdatedAt == null) {
                return 1;
            }
            if (rightUpdatedAt == null) {
                return -1;
            }

            return rightUpdatedAt.compareTo(leftUpdatedAt);
        };
    }

    private BattleSummaryDto toSummaryDto(BattleStateEntity entity) {
        List<BattleTokenData> tokens = normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()));
        List<BattleObstacleData> obstacles = normalizeObstacles(battleObstacleJsonCodec.read(entity.getObstaclesJson()));

        return new BattleSummaryDto(
            entity.getId(),
            entity.getSlug(),
            normalizedOrNull(entity.getLandmarkSlug()),
            toStatusValue(effectiveStatus(entity)),
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            entity.getEndedAt(),
            tokens.size(),
            obstacles.size()
        );
    }

    private BattleStateDto toDto(BattleStateEntity entity) {
        List<BattleTokenData> tokens = normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()));
        List<BattleObstacleData> obstacles = normalizeObstacles(battleObstacleJsonCodec.read(entity.getObstaclesJson()));
        Integer normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(entity.getCurrentTurnTokenNumber(), tokens);

        return new BattleStateDto(
            entity.getId(),
            entity.getSlug(),
            requireLandmarkSlug(entity.getLandmarkSlug()),
            toStatusValue(effectiveStatus(entity)),
            resolveNextTokenNumber(entity.getNextTokenNumber(), tokens),
            normalizedCurrentTurnTokenNumber,
            tokens,
            resolveNextObstacleId(entity.getNextObstacleId(), obstacles),
            obstacles,
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            entity.getEndedAt()
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

    private Integer normalizeCurrentTurnTokenNumber(Integer requestedCurrentTurnTokenNumber, List<BattleTokenData> tokens) {
        List<BattleTokenData> orderedTokens = getOrderedInitiativeTokens(tokens);
        if (orderedTokens.isEmpty()) {
            return null;
        }

        if (
            requestedCurrentTurnTokenNumber != null &&
            orderedTokens.stream().anyMatch(token -> Objects.equals(token.number(), requestedCurrentTurnTokenNumber))
        ) {
            return requestedCurrentTurnTokenNumber;
        }

        return orderedTokens.get(0).number();
    }

    private List<BattleTokenData> getOrderedInitiativeTokens(List<BattleTokenData> tokens) {
        if (tokens == null) {
            return List.of();
        }

        return tokens.stream()
            .filter(this::isEligibleForInitiative)
            .sorted(
                Comparator.comparing(BattleTokenData::initiative, Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(BattleTokenData::number, Comparator.nullsLast(Comparator.naturalOrder()))
            )
            .collect(Collectors.toList());
    }

    private boolean isEligibleForInitiative(BattleTokenData token) {
        if (token == null) {
            return false;
        }

        if (Boolean.TRUE.equals(token.hidden())) {
            return false;
        }

        if ("enemy".equals(token.type())) {
            return token.life() != null && token.life() > 0;
        }

        return true;
    }

    private BattleTokenData normalizeToken(BattleTokenData token) {
        int number = positiveInt(token.number(), 1);
        String type = normalizeTokenType(token.type());
        String nombre = normalizedOrNull(token.nombre());
        Integer characterId = positiveOptionalInt(token.characterId());
        if (nombre == null) {
            nombre = "%s %d".formatted(type.equals("player") ? "Jugador" : "Enemigo", number);
        }

        Integer life = optionalInt(token.life());
        boolean hidden = token.hidden() != null && token.hidden();

        return new BattleTokenData(
            number,
            trimToLength(nombre, 120),
            characterId,
            type,
            clampPercent(token.x(), 50),
            clampPercent(token.y(), 50),
            optionalInt(token.initiative()),
            life,
            clampTokenSize(token.size(), 1),
            trimToLength(normalizedOrNull(token.status()), 200),
            hidden
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

    private String requireLandmarkSlug(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarkSlug es obligatorio");
        }
        return normalized;
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

        return Math.max(0, Math.min(100, value));
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

    private Integer positiveOptionalInt(Integer value) {
        if (value == null || value < 1) {
            return null;
        }
        return value;
    }

    private BattleStatus effectiveStatus(BattleStateEntity entity) {
        return entity.getStatus() == null ? BattleStatus.FINISHED : entity.getStatus();
    }

    private String toStatusValue(BattleStatus status) {
        return status == BattleStatus.ACTIVE ? "active" : "finished";
    }

    private String buildBattleSlug() {
        return "battle-" + UUID.randomUUID();
    }
}
