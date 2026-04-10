package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "party_inventory_items")
@Getter
@Setter
public class PartyInventoryItemEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String kind;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false)
    private Integer quantity = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "carrier_character_id")
    private CharacterEntity carrierCharacter;

    @Column(name = "carried_by", length = 120)
    private String carriedBy;

    @Column(name = "is_important", nullable = false)
    private boolean important = false;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "source_item_name", length = 200)
    private String sourceItemName;

    @Column(name = "source_item_type_code", length = 30)
    private String sourceItemTypeCode;
}
