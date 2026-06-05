package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.PartyInventoryBalanceDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryItemDto;
import com.sistema.dnd.sistema.dto.domain.PartyInventoryItemUpsertRequest;
import com.sistema.dnd.sistema.services.PartyInventoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/party-inventory")
public class PartyInventoryController {

    private final PartyInventoryService partyInventoryService;

    public PartyInventoryController(PartyInventoryService partyInventoryService) {
        this.partyInventoryService = partyInventoryService;
    }

    @GetMapping
    public PartyInventoryDto find() {
        return partyInventoryService.find();
    }

    @PutMapping("/balance")
    public PartyInventoryBalanceDto updateBalance(@Valid @RequestBody PartyInventoryBalanceDto request) {
        return partyInventoryService.updateBalance(request);
    }

    @PostMapping("/items")
    public ResponseEntity<PartyInventoryItemDto> createItem(@Valid @RequestBody PartyInventoryItemUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partyInventoryService.createItem(request));
    }

    @PutMapping("/items/{id}")
    public PartyInventoryItemDto updateItem(@PathVariable Long id, @Valid @RequestBody PartyInventoryItemUpsertRequest request) {
        return partyInventoryService.updateItem(id, request);
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        partyInventoryService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }
}
