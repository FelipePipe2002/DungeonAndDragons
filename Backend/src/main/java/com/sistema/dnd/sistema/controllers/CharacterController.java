package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.CharacterDto;
import com.sistema.dnd.sistema.dto.domain.CharacterUpsertRequest;
import com.sistema.dnd.sistema.services.CharacterService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/characters")
public class CharacterController {

    private final CharacterService characterService;

    public CharacterController(CharacterService characterService) {
        this.characterService = characterService;
    }

    @GetMapping
    public List<CharacterDto> findAll(@RequestParam(required = false) Boolean isPlayer) {
        if (isPlayer != null) {
            return characterService.findByPlayer(isPlayer);
        }

        return characterService.findAll();
    }

    @GetMapping("/{id}")
    public CharacterDto findById(@PathVariable Long id) {
        return characterService.findById(id);
    }

    @PostMapping
    public ResponseEntity<CharacterDto> create(@Valid @RequestBody CharacterUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(characterService.create(request));
    }

    @PutMapping("/{id}")
    public CharacterDto update(@PathVariable Long id, @Valid @RequestBody CharacterUpsertRequest request) {
        return characterService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        characterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
