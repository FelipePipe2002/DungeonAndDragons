package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BattleObstacleData;
import com.sistema.dnd.sistema.dto.domain.BattleCenterHistoryDto;
import com.sistema.dnd.sistema.dto.domain.BattleDungeonFogData;
import com.sistema.dnd.sistema.dto.domain.BattleFogRevealData;
import com.sistema.dnd.sistema.dto.domain.BattleStateDto;
import com.sistema.dnd.sistema.dto.domain.BattleStateUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.BattleSummaryDto;
import com.sistema.dnd.sistema.dto.domain.BattleTokenData;
import com.sistema.dnd.sistema.dto.domain.CreateBattleRequest;
import com.sistema.dnd.sistema.dto.domain.UpdateBattleStateRequest;
import com.sistema.dnd.sistema.entity.BattleSceneType;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BattleStateService {

    private final BattleStateRepository battleStateRepository;
    private final BattleStateJsonCodec battleStateJsonCodec;
    private final BattleObstacleJsonCodec battleObstacleJsonCodec;
    private final BattleFogRevealJsonCodec battleFogRevealJsonCodec;
    private final BattleDungeonFogJsonCodec battleDungeonFogJsonCodec;

    public BattleStateService(
        BattleStateRepository battleStateRepository,
        BattleStateJsonCodec battleStateJsonCodec,
        BattleObstacleJsonCodec battleObstacleJsonCodec,
        BattleFogRevealJsonCodec battleFogRevealJsonCodec,
        BattleDungeonFogJsonCodec battleDungeonFogJsonCodec
    ) {
        this.battleStateRepository = battleStateRepository;
        this.battleStateJsonCodec = battleStateJsonCodec;
        this.battleObstacleJsonCodec = battleObstacleJsonCodec;
        this.battleFogRevealJsonCodec = battleFogRevealJsonCodec;
        this.battleDungeonFogJsonCodec = battleDungeonFogJsonCodec;
    }

    public BattleStateDto findCurrent() {
        return battleStateRepository
            .findFirstByStatusOrderByUpdatedAtDesc(BattleStatus.ACTIVE)
            .map(this::toDto)
            .orElse(null);
    }

    @Deprecated(since = "2026-03", forRemoval = false)
    public BattleStateDto updateCurrent(BattleStateUpsertRequest request) {
        throw new ResponseStatusException(HttpStatus.GONE, "Usa /v1/battles/{id}");
    }

    public BattleStateDto findById(Long id) {
        return toDto(requireBattle(id));
    }

    public BattleStateDto findActiveByScene(String sceneType, String sceneSlug) {
        BattleSceneType normalizedSceneType = requireSceneType(sceneType);
        String normalizedSceneSlug = requireSceneSlug(sceneSlug);

        return battleStateRepository
            .findFirstBySceneTypeAndSceneSlugAndStatusOrderByUpdatedAtDesc(
                normalizedSceneType,
                normalizedSceneSlug,
                BattleStatus.ACTIVE
            )
            .map(this::toDto)
            .orElse(null);
    }

    public List<BattleSummaryDto> findHistory(String parentLandmarkSlug, String sceneType, String sceneSlug) {
        String normalizedParentLandmarkSlug = requireParentLandmarkSlug(parentLandmarkSlug);
        String normalizedSceneSlug = normalizedOrNull(sceneSlug);
        BattleSceneType normalizedSceneType = normalizedSceneSlug == null ? null : requireSceneType(sceneType);

        List<BattleStateEntity> battles = normalizedSceneSlug == null
            ? battleStateRepository.findByParentLandmarkSlugOrderByUpdatedAtDesc(normalizedParentLandmarkSlug)
            : battleStateRepository.findByParentLandmarkSlugAndSceneTypeAndSceneSlugOrderByUpdatedAtDesc(
                normalizedParentLandmarkSlug,
                normalizedSceneType,
                normalizedSceneSlug
            );

        return battles.stream()
            .sorted(historyComparator())
            .map(this::toSummaryDto)
            .collect(Collectors.toList());
    }

    public BattleCenterHistoryDto findCenterHistory(String sceneType, Integer page, Integer pageSize) {
        BattleSceneType normalizedSceneType = normalizedOrNull(sceneType) == null ? null : requireSceneType(sceneType);
        int normalizedPage = Math.max(page == null ? 0 : page, 0);
        int normalizedPageSize = Math.max(1, Math.min(pageSize == null ? 12 : pageSize, 50));
        Pageable finishedPageable = PageRequest.of(
            normalizedPage,
            normalizedPageSize,
            Sort.by(
                Sort.Order.desc("endedAt"),
                Sort.Order.desc("updatedAt"),
                Sort.Order.desc("createdAt")
            )
        );

        List<BattleSummaryDto> activeBattles = (normalizedSceneType == null
            ? battleStateRepository.findByStatusOrderByUpdatedAtDesc(BattleStatus.ACTIVE)
            : battleStateRepository.findBySceneTypeAndStatusOrderByUpdatedAtDesc(normalizedSceneType, BattleStatus.ACTIVE))
            .stream()
            .sorted(activeHistoryComparator())
            .map(this::toSummaryDto)
            .collect(Collectors.toList());

        Page<BattleStateEntity> finishedBattlePage = normalizedSceneType == null
            ? battleStateRepository.findByStatus(BattleStatus.FINISHED, finishedPageable)
            : battleStateRepository.findBySceneTypeAndStatus(normalizedSceneType, BattleStatus.FINISHED, finishedPageable);

        List<BattleSummaryDto> finishedBattles = finishedBattlePage.getContent().stream()
            .sorted(finishedHistoryComparator())
            .map(this::toSummaryDto)
            .collect(Collectors.toList());

        return new BattleCenterHistoryDto(
            activeBattles,
            finishedBattles,
            finishedBattlePage.getNumber(),
            finishedBattlePage.getSize(),
            finishedBattlePage.getTotalElements(),
            finishedBattlePage.getTotalPages(),
            finishedBattlePage.hasPrevious(),
            finishedBattlePage.hasNext()
        );
    }

    @Transactional
    public BattleStateDto create(CreateBattleRequest request) {
        BattleSceneType sceneType = requireSceneType(request == null ? null : request.sceneType());
        String sceneSlug = requireSceneSlug(request == null ? null : request.sceneSlug());
        String parentLandmarkSlug = normalizeParentLandmarkSlug(
            request == null ? null : request.parentLandmarkSlug(),
            sceneType,
            sceneSlug
        );

        ensureNoOtherActiveBattleForScene(sceneType, sceneSlug, null);

        BattleStateEntity entity = new BattleStateEntity();
        entity.setSlug(buildBattleSlug());
        entity.setSceneType(sceneType);
        entity.setSceneSlug(sceneSlug);
        entity.setParentLandmarkSlug(parentLandmarkSlug);
        entity.setTitle(defaultBattleTitle(sceneSlug));
        entity.setStatus(BattleStatus.ACTIVE);
        entity.setEndedAt(null);
        entity.setRoundNumber(1);
        entity.setDmNotes(null);
        entity.setNextTokenNumber(1);
        entity.setCurrentTurnTokenNumber(null);
        entity.setTokensJson("[]");
        entity.setNextObstacleId(1);
        entity.setObstaclesJson("[]");
        entity.setFogEnabled(false);
        entity.setNextFogRevealId(1);
        entity.setFogRevealsJson("[]");
        entity.setDungeonFogJson(battleDungeonFogJsonCodec.write(normalizeDungeonFog(null)));

        return toDto(battleStateRepository.save(entity));
    }

    @Transactional
    public BattleStateDto update(Long id, UpdateBattleStateRequest request) {
        BattleStateEntity entity = requireBattle(id);
        ensureEditable(entity);

        List<BattleTokenData> normalizedTokens = normalizeTokens(request == null ? null : request.tokens());
        List<BattleObstacleData> normalizedObstacles = normalizeObstacles(request == null ? null : request.obstacles());
        List<BattleFogRevealData> normalizedFogReveals = normalizeFogReveals(request == null ? null : request.fogReveals());
        BattleDungeonFogData normalizedDungeonFog = normalizeDungeonFog(request == null ? null : request.dungeonFog());
        Integer normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(
            request == null ? null : request.currentTurnTokenNumber(),
            normalizedTokens
        );

        entity.setTitle(normalizeBattleTitle(request == null ? null : request.title(), entity.getSceneSlug()));
        entity.setRoundNumber(normalizeRoundNumber(request == null ? null : request.roundNumber()));
        entity.setDmNotes(normalizeBattleNotes(request == null ? null : request.dmNotes()));
        entity.setNextTokenNumber(resolveNextTokenNumber(request == null ? null : request.nextTokenNumber(), normalizedTokens));
        entity.setCurrentTurnTokenNumber(normalizedCurrentTurnTokenNumber);
        entity.setTokensJson(battleStateJsonCodec.write(normalizedTokens));
        entity.setNextObstacleId(resolveNextObstacleId(request == null ? null : request.nextObstacleId(), normalizedObstacles));
        entity.setObstaclesJson(battleObstacleJsonCodec.write(normalizedObstacles));
        entity.setFogEnabled(request != null && Boolean.TRUE.equals(request.fogEnabled()));
        entity.setNextFogRevealId(resolveNextFogRevealId(request == null ? null : request.nextFogRevealId(), normalizedFogReveals));
        entity.setFogRevealsJson(battleFogRevealJsonCodec.write(normalizedFogReveals));
        entity.setDungeonFogJson(battleDungeonFogJsonCodec.write(normalizedDungeonFog));
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
        ensureNoOtherActiveBattleForScene(entity.getSceneType(), entity.getSceneSlug(), entity.getId());

        entity.setStatus(BattleStatus.ACTIVE);
        entity.setEndedAt(null);
        entity.setTitle(normalizeBattleTitle(entity.getTitle(), entity.getSceneSlug()));
        entity.setRoundNumber(normalizeRoundNumber(entity.getRoundNumber()));
        entity.setDmNotes(normalizeBattleNotes(entity.getDmNotes()));
        entity.setCurrentTurnTokenNumber(
            normalizeCurrentTurnTokenNumber(
                entity.getCurrentTurnTokenNumber(),
                normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()))
            )
        );

        return toDto(battleStateRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        BattleStateEntity entity = requireBattle(id);
        battleStateRepository.delete(entity);
    }

    private BattleStateEntity requireBattle(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id invalido");
        }

        return battleStateRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Batalla no encontrada"));
    }

    private void ensureNoOtherActiveBattleForScene(BattleSceneType sceneType, String sceneSlug, Long currentBattleId) {
        battleStateRepository.findFirstBySceneTypeAndSceneSlugAndStatusOrderByUpdatedAtDesc(
            sceneType,
            sceneSlug,
            BattleStatus.ACTIVE
        ).ifPresent(existing -> {
            if (!Objects.equals(existing.getId(), currentBattleId)) {
                throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ya existe una batalla activa para esta escena"
                );
            }
        });
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

    private Comparator<BattleStateEntity> activeHistoryComparator() {
        return Comparator
            .comparing(BattleStateEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(BattleStateEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private Comparator<BattleStateEntity> finishedHistoryComparator() {
        return Comparator
            .comparing(BattleStateEntity::getEndedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(BattleStateEntity::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(BattleStateEntity::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private BattleSummaryDto toSummaryDto(BattleStateEntity entity) {
        List<BattleTokenData> tokens = normalizeTokens(battleStateJsonCodec.read(entity.getTokensJson()));
        List<BattleObstacleData> obstacles = normalizeObstacles(battleObstacleJsonCodec.read(entity.getObstaclesJson()));

        return new BattleSummaryDto(
            entity.getId(),
            entity.getSlug(),
            toSceneTypeValue(entity.getSceneType()),
            requireSceneSlug(entity.getSceneSlug()),
            requireParentLandmarkSlug(entity.getParentLandmarkSlug()),
            normalizeBattleTitle(entity.getTitle(), entity.getSceneSlug()),
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
        List<BattleFogRevealData> fogReveals = normalizeFogReveals(battleFogRevealJsonCodec.read(entity.getFogRevealsJson()));
        BattleDungeonFogData dungeonFog = normalizeDungeonFog(battleDungeonFogJsonCodec.read(entity.getDungeonFogJson()));
        Integer normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(entity.getCurrentTurnTokenNumber(), tokens);

        return new BattleStateDto(
            entity.getId(),
            entity.getSlug(),
            toSceneTypeValue(entity.getSceneType()),
            requireSceneSlug(entity.getSceneSlug()),
            requireParentLandmarkSlug(entity.getParentLandmarkSlug()),
            normalizeBattleTitle(entity.getTitle(), entity.getSceneSlug()),
            toStatusValue(effectiveStatus(entity)),
            normalizeRoundNumber(entity.getRoundNumber()),
            normalizeBattleNotes(entity.getDmNotes()),
            resolveNextTokenNumber(entity.getNextTokenNumber(), tokens),
            normalizedCurrentTurnTokenNumber,
            tokens,
            resolveNextObstacleId(entity.getNextObstacleId(), obstacles),
            obstacles,
            Boolean.TRUE.equals(entity.getFogEnabled()),
            resolveNextFogRevealId(entity.getNextFogRevealId(), fogReveals),
            fogReveals,
            dungeonFog,
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

    private List<BattleFogRevealData> normalizeFogReveals(List<BattleFogRevealData> fogReveals) {
        if (fogReveals == null) {
            return List.of();
        }

        return fogReveals.stream()
            .filter(Objects::nonNull)
            .map(this::normalizeFogReveal)
            .sorted(Comparator.comparing(BattleFogRevealData::id))
            .collect(Collectors.toList());
    }

    private BattleDungeonFogData normalizeDungeonFog(BattleDungeonFogData dungeonFog) {
        List<String> exploredCellKeys = dungeonFog == null || dungeonFog.exploredCellKeys() == null
            ? List.of()
            : dungeonFog.exploredCellKeys().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> value.matches("^-?\\d+,-?\\d+$"))
                .distinct()
                .sorted()
                .collect(Collectors.toList());
        int brightRadius = clampInt(dungeonFog == null ? null : dungeonFog.playerVisionBrightRadiusCells(), 4, 0, 64);
        int dimRadius = clampInt(dungeonFog == null ? null : dungeonFog.playerVisionDimRadiusCells(), 8, brightRadius, 128);

        return new BattleDungeonFogData(
            dungeonFog != null && Boolean.TRUE.equals(dungeonFog.enabled()),
            exploredCellKeys,
            brightRadius,
            dimRadius
        );
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
        String sourceType = normalizeTokenSourceType(token.sourceType(), characterId);
        String sourceRef = normalizeTokenSourceRef(token.sourceRef(), sourceType, characterId);
        String image = normalizedOrNull(token.image());
        Long imageAssetId = positiveOptionalLong(token.imageAssetId());
        Double imageFocusX = clampPercent(token.imageFocusX(), 50);
        Double imageFocusY = clampPercent(token.imageFocusY(), 50);
        Double imageZoom = clampTokenImageZoom(token.imageZoom(), 1);
        if (nombre == null) {
            nombre = "%s %d".formatted(type.equals("player") ? "Jugador" : "Enemigo", number);
        }

        if (imageAssetId != null) {
            image = null;
        }

        Integer life = optionalInt(token.life());
        boolean hidden = token.hidden() != null && token.hidden();
        String status = trimToLength(normalizedOrNull(token.status()), 200);
        Integer statusDurationTurns = status == null ? null : nonNegativeOptionalInt(token.statusDurationTurns());

        return new BattleTokenData(
            number,
            trimToLength(nombre, 120),
            characterId,
            sourceType,
            sourceRef,
            trimToLength(image, 2000),
            imageAssetId,
            imageFocusX,
            imageFocusY,
            imageZoom,
            type,
            clampPercent(token.x(), 50),
            clampPercent(token.y(), 50),
            optionalInt(token.initiative()),
            life,
            clampTokenSize(token.size(), 1),
            status,
            statusDurationTurns,
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

    private BattleFogRevealData normalizeFogReveal(BattleFogRevealData fogReveal) {
        int id = positiveInt(fogReveal.id(), 1);
        double width = clampFogRevealDimension(fogReveal.width(), 12);
        double height = clampFogRevealDimension(fogReveal.height(), 12);
        double x = clampPercent(fogReveal.x(), 44);
        double y = clampPercent(fogReveal.y(), 44);

        x = Math.min(x, 100 - width);
        y = Math.min(y, 100 - height);

        return new BattleFogRevealData(id, x, y, width, height);
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

    private int resolveNextFogRevealId(Integer requestedNextFogRevealId, List<BattleFogRevealData> fogReveals) {
        int maxFogRevealId = fogReveals.stream()
            .map(BattleFogRevealData::id)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .max()
            .orElse(0);

        int normalizedRequested = positiveInt(requestedNextFogRevealId, 1);
        return Math.max(normalizedRequested, maxFogRevealId + 1);
    }

    private String normalizeTokenType(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return "enemy";
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        return lowered.equals("player") ? "player" : "enemy";
    }

    private String normalizeTokenSourceType(String value, Integer characterId) {
        if (characterId != null) {
            return "character";
        }

        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return "manual";
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        return lowered.equals("monster") ? "monster" : "manual";
    }

    private String normalizeTokenSourceRef(String value, String sourceType, Integer characterId) {
        if ("character".equals(sourceType) && characterId != null) {
            return String.valueOf(characterId);
        }

        if ("monster".equals(sourceType)) {
            return trimToLength(normalizedOrNull(value), 255);
        }

        return null;
    }

    private String normalizeObstacleShape(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            return "rectangle";
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        return lowered.equals("circle") ? "circle" : "rectangle";
    }

    private double clampFogRevealDimension(Double value, double fallback) {
        if (value == null || !Double.isFinite(value)) {
            return fallback;
        }

        return Math.round(Math.max(0.1, Math.min(100, value)) * 100.0) / 100.0;
    }

    private String normalizeBattleTitle(String value, String sceneSlug) {
        String normalized = trimToLength(normalizedOrNull(value), 255);
        if (normalized != null) {
            return normalized;
        }

        return defaultBattleTitle(sceneSlug);
    }

    private int normalizeRoundNumber(Integer value) {
        return positiveInt(value, 1);
    }

    private String normalizeBattleNotes(String value) {
        return trimToLength(normalizedOrNull(value), 8000);
    }

    private BattleSceneType requireSceneType(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sceneType es obligatorio");
        }

        String lowered = normalized.toLowerCase(Locale.ROOT);
        if (lowered.equals("building")) {
            return BattleSceneType.BUILDING;
        }
        if (lowered.equals("landmark")) {
            return BattleSceneType.LANDMARK;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sceneType invalido");
    }

    private String requireSceneSlug(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sceneSlug es obligatorio");
        }
        return normalized;
    }

    private String requireParentLandmarkSlug(String value) {
        String normalized = normalizedOrNull(value);
        if (normalized == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentLandmarkSlug es obligatorio");
        }
        return normalized;
    }

    private String normalizeParentLandmarkSlug(String value, BattleSceneType sceneType, String sceneSlug) {
        String normalized = normalizedOrNull(value);
        if (normalized != null) {
            return normalized;
        }

        if (sceneType == BattleSceneType.LANDMARK) {
            return sceneSlug;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "parentLandmarkSlug es obligatorio");
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

        return value;
    }

    private Double clampTokenImageZoom(Double value, double fallback) {
        if (value == null || !Double.isFinite(value)) {
            return fallback;
        }

        return Math.max(1, Math.min(3, value));
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

    private int clampInt(Integer value, int fallback, int min, int max) {
        int normalized = value == null ? fallback : value;
        return Math.max(min, Math.min(max, normalized));
    }

    private Integer positiveOptionalInt(Integer value) {
        if (value == null || value < 1) {
            return null;
        }
        return value;
    }

    private Integer nonNegativeOptionalInt(Integer value) {
        if (value == null || value < 0) {
            return null;
        }
        return value;
    }

    private Long positiveOptionalLong(Long value) {
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

    private String toSceneTypeValue(BattleSceneType sceneType) {
        return sceneType == BattleSceneType.BUILDING ? "building" : "landmark";
    }

    private String buildBattleSlug() {
        return "battle-" + UUID.randomUUID();
    }

    private String defaultBattleTitle(String sceneSlug) {
        String normalizedSlug = requireSceneSlug(sceneSlug)
            .replace("/edificio/", " / ");
        String[] parts = normalizedSlug.split("[-/]");
        String label = java.util.Arrays.stream(parts)
            .filter(part -> !part.isBlank())
            .map(part -> Character.toUpperCase(part.charAt(0)) + part.substring(1))
            .collect(Collectors.joining(" "));

        if (label.isBlank()) {
            return "Batalla";
        }

        return "Batalla en " + label;
    }
}
