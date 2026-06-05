package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "party_inventory_balance")
@Getter
@Setter
public class PartyInventoryBalanceEntity {

    @Id
    private Long id;

    @Column(nullable = false)
    private Long copper = 0L;

    @Column(nullable = false)
    private Long silver = 0L;

    @Column(nullable = false)
    private Long gold = 0L;

    @Column(nullable = false)
    private Long platinum = 0L;
}
