package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.PartyInventoryBalanceDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryBalanceUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryItemDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryItemUpsertRequest;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.PartyInventoryBalanceEntity;
import com.sistema.dnd.sistema.entity.PartyInventoryItemEntity;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.PartyInventoryBalanceRepository;
import com.sistema.dnd.sistema.repository.PartyInventoryItemRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PartyInventoryService {

    private static final long BALANCE_SINGLETON_ID = 1L;
    private static final Set<String> ALLOWED_ITEM_KINDS = Set.of("catalog-item", "custom-item");

    private final CharacterRepository characterRepository;
    private final PartyInventoryBalanceRepository partyInventoryBalanceRepository;
    private final PartyInventoryItemRepository partyInventoryItemRepository;

    public PartyInventoryService(
        CharacterRepository characterRepository,
        PartyInventoryBalanceRepository partyInventoryBalanceRepository,
        PartyInventoryItemRepository partyInventoryItemRepository
    ) {
        this.characterRepository = characterRepository;
        this.partyInventoryBalanceRepository = partyInventoryBalanceRepository;
        this.partyInventoryItemRepository = partyInventoryItemRepository;
    }

    @Transactional
    public PartyInventoryDto find() {
        return new PartyInventoryDto(
            toBalanceDto(findExistingBalance()),
            partyInventoryItemRepository.findAllByOrderByUpdatedAtDescIdDesc().stream().map(this::toItemDto).toList()
        );
    }

    @Transactional
    public PartyInventoryBalanceDto updateBalance(PartyInventoryBalanceUpsertRequest request) {
        PartyInventoryBalanceEntity entity = partyInventoryBalanceRepository.findById(BALANCE_SINGLETON_ID)
            .orElseGet(() -> {
                PartyInventoryBalanceEntity created = new PartyInventoryBalanceEntity();
                created.setId(BALANCE_SINGLETON_ID);
                created.setCopper(0L);
                created.setSilver(0L);
                created.setGold(0L);
                created.setPlatinum(0L);
                return created;
            });
        entity.setCopper(nonNegative(request.copper(), "El cobre no puede ser negativo"));
        entity.setSilver(nonNegative(request.silver(), "La plata no puede ser negativa"));
        entity.setGold(nonNegative(request.gold(), "El oro no puede ser negativo"));
        entity.setPlatinum(nonNegative(request.platinum(), "El platino no puede ser negativo"));
        return toBalanceDto(partyInventoryBalanceRepository.save(entity));
    }

    @Transactional
    public PartyInventoryItemDto createItem(PartyInventoryItemUpsertRequest request) {
        PartyInventoryItemEntity entity = new PartyInventoryItemEntity();
        applyItem(entity, request);
        return toItemDto(partyInventoryItemRepository.save(entity));
    }

    @Transactional
    public PartyInventoryItemDto updateItem(Long id, PartyInventoryItemUpsertRequest request) {
        PartyInventoryItemEntity entity = partyInventoryItemRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item de inventario no encontrado"));

        applyItem(entity, request);
        return toItemDto(partyInventoryItemRepository.save(entity));
    }

    @Transactional
    public void deleteItem(Long id) {
        PartyInventoryItemEntity entity = partyInventoryItemRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item de inventario no encontrado"));
        partyInventoryItemRepository.delete(entity);
    }

    private void applyItem(PartyInventoryItemEntity entity, PartyInventoryItemUpsertRequest request) {
        String normalizedKind = normalizeKind(request.kind());
        CharacterEntity carrierCharacter = resolveCarrierCharacter(request.carrierCharacterId());
        entity.setKind(normalizedKind);
        entity.setName(requiredTrimmed(request.name(), "El nombre es obligatorio"));
        entity.setQuantity(requirePositiveQuantity(request.quantity()));
        entity.setCarrierCharacter(carrierCharacter);
        entity.setCarriedBy(resolveCarrierName(carrierCharacter, request.carriedBy()));
        entity.setImportant(Boolean.TRUE.equals(request.important()));
        entity.setNotes(normalizedOrNull(request.notes()));
        entity.setSourceItemName(normalizedOrNull(request.sourceItemName()));
        entity.setSourceItemTypeCode(normalizedOrNull(request.sourceItemTypeCode()));
    }

    private PartyInventoryBalanceEntity findExistingBalance() {
        return partyInventoryBalanceRepository.findById(BALANCE_SINGLETON_ID)
            .orElseGet(() -> {
                PartyInventoryBalanceEntity entity = new PartyInventoryBalanceEntity();
                entity.setId(BALANCE_SINGLETON_ID);
                entity.setCopper(0L);
                entity.setSilver(0L);
                entity.setGold(0L);
                entity.setPlatinum(0L);
                return entity;
            });
    }

    private PartyInventoryBalanceDto toBalanceDto(PartyInventoryBalanceEntity entity) {
        return new PartyInventoryBalanceDto(
            entity.getCopper(),
            entity.getSilver(),
            entity.getGold(),
            entity.getPlatinum(),
            entity.getUpdatedAt()
        );
    }

    private PartyInventoryItemDto toItemDto(PartyInventoryItemEntity entity) {
        return new PartyInventoryItemDto(
            entity.getId(),
            entity.getKind(),
            entity.getName(),
            entity.getQuantity(),
            entity.getCarrierCharacter() != null ? entity.getCarrierCharacter().getId() : null,
            entity.getCarriedBy(),
            entity.isImportant(),
            entity.getNotes(),
            entity.getSourceItemName(),
            entity.getSourceItemTypeCode(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String normalizeKind(String value) {
        String normalized = requiredTrimmed(value, "El tipo de item es obligatorio").toLowerCase(Locale.ROOT);
        if (!ALLOWED_ITEM_KINDS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo de item no es valido");
        }
        return normalized;
    }

    private long nonNegative(Long value, String message) {
        if (value == null || value < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

    private int requirePositiveQuantity(Integer value) {
        if (value == null || value < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad debe ser al menos 1");
        }
        return value;
    }

    private CharacterEntity resolveCarrierCharacter(Long carrierCharacterId) {
        if (carrierCharacterId == null) {
            return null;
        }

        return characterRepository.findById(carrierCharacterId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El personaje portador no existe"));
    }

    private String resolveCarrierName(CharacterEntity carrierCharacter, String carriedBy) {
        if (carrierCharacter != null) {
            return carrierCharacter.getNombre();
        }

        return normalizedOrNull(carriedBy);
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizedOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
