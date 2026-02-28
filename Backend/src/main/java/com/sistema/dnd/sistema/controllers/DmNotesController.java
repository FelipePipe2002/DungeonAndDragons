package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.DmNotesDto;
import com.sistema.dnd.sistema.dto.domain.DmNotesUpsertRequest;
import com.sistema.dnd.sistema.services.DmNotesService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/dm-notes")
public class DmNotesController {

    private final DmNotesService dmNotesService;

    public DmNotesController(DmNotesService dmNotesService) {
        this.dmNotesService = dmNotesService;
    }

    @GetMapping
    public DmNotesDto find() {
        return dmNotesService.find();
    }

    @PutMapping
    public DmNotesDto update(@Valid @RequestBody DmNotesUpsertRequest request) {
        return dmNotesService.update(request);
    }
}
