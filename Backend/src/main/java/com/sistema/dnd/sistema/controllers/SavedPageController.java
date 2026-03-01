package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.SavedPageDto;
import com.sistema.dnd.sistema.dto.domain.SavedPageUpsertRequest;
import com.sistema.dnd.sistema.services.SavedPageService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/pages")
public class SavedPageController {

    private final SavedPageService savedPageService;

    public SavedPageController(SavedPageService savedPageService) {
        this.savedPageService = savedPageService;
    }

    @GetMapping
    public List<SavedPageDto> findAll() {
        return savedPageService.findAll();
    }

    @PostMapping
    public ResponseEntity<SavedPageDto> create(@Valid @RequestBody SavedPageUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPageService.create(request));
    }

    @PutMapping("/{id}")
    public SavedPageDto update(@PathVariable Long id, @Valid @RequestBody SavedPageUpsertRequest request) {
        return savedPageService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        savedPageService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
