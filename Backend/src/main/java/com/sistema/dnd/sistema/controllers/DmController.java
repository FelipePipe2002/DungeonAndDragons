package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.DmNotesDto;
import com.sistema.dnd.sistema.dto.domain.DmOpenLoopDto;
import com.sistema.dnd.sistema.dto.domain.DmRelationshipDto;
import com.sistema.dnd.sistema.dto.domain.EventDto;
import com.sistema.dnd.sistema.services.DmService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DmController {

    private final DmService dmService;

    public DmController(DmService dmService) {
        this.dmService = dmService;
    }

    @GetMapping({"/v1/dm/events", "/v1/dm-events"})
    public List<EventDto> findEvents() {
        return dmService.findAllEvents();
    }

    @PostMapping({"/v1/dm/events", "/v1/dm-events"})
    public ResponseEntity<EventDto> createEvent(@Valid @RequestBody EventDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmService.createEvent(request));
    }

    @DeleteMapping({"/v1/dm/events/{id}", "/v1/dm-events/{id}"})
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        dmService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/v1/dm/notes", "/v1/dm-notes"})
    public DmNotesDto findNotes() {
        return dmService.findNotes();
    }

    @PutMapping({"/v1/dm/notes", "/v1/dm-notes"})
    public DmNotesDto updateNotes(@Valid @RequestBody DmNotesDto request) {
        return dmService.updateNotes(request);
    }

    @GetMapping({"/v1/dm/open-loops", "/v1/dm-open-loops"})
    public List<DmOpenLoopDto> findOpenLoops() {
        return dmService.findAllOpenLoops();
    }

    @PostMapping({"/v1/dm/open-loops", "/v1/dm-open-loops"})
    public ResponseEntity<DmOpenLoopDto> createOpenLoop(@Valid @RequestBody DmOpenLoopDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmService.createOpenLoop(request));
    }

    @PutMapping({"/v1/dm/open-loops/{id}", "/v1/dm-open-loops/{id}"})
    public DmOpenLoopDto updateOpenLoop(@PathVariable Long id, @Valid @RequestBody DmOpenLoopDto request) {
        return dmService.updateOpenLoop(id, request);
    }

    @DeleteMapping({"/v1/dm/open-loops/{id}", "/v1/dm-open-loops/{id}"})
    public ResponseEntity<Void> deleteOpenLoop(@PathVariable Long id) {
        dmService.deleteOpenLoop(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/v1/dm/relationships", "/v1/dm-relationships"})
    public List<DmRelationshipDto> findRelationships() {
        return dmService.findAllRelationships();
    }

    @PostMapping({"/v1/dm/relationships", "/v1/dm-relationships"})
    public ResponseEntity<DmRelationshipDto> createRelationship(@Valid @RequestBody DmRelationshipDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dmService.createRelationship(request));
    }

    @PutMapping({"/v1/dm/relationships/{id}", "/v1/dm-relationships/{id}"})
    public DmRelationshipDto updateRelationship(
        @PathVariable Long id,
        @Valid @RequestBody DmRelationshipDto request
    ) {
        return dmService.updateRelationship(id, request);
    }

    @DeleteMapping({"/v1/dm/relationships/{id}", "/v1/dm-relationships/{id}"})
    public ResponseEntity<Void> deleteRelationship(@PathVariable Long id) {
        dmService.deleteRelationship(id);
        return ResponseEntity.noContent().build();
    }
}
