"""
Formal Concept Analysis (FCA) implementation for generating concept lattices.
This module provides algorithms to create concept lattices from transaction data.
"""

import pandas as pd
import numpy as np
from typing import List, Set, Tuple, Dict, Any, Optional
import itertools
from collections import defaultdict

class FormalContext:
    """Represents a formal context for Formal Concept Analysis"""

    def __init__(self, objects: List[str], attributes: List[str], incidence: np.ndarray):
        self.objects = objects
        self.attributes = attributes
        self.incidence = incidence
        self.object_to_idx = {obj: idx for idx, obj in enumerate(objects)}
        self.attribute_to_idx = {attr: idx for idx, attr in enumerate(attributes)}

    def get_objects_with_attributes(self, attributes: Set[str]) -> Set[str]:
        """Get all objects that have all the given attributes"""
        if not attributes:
            return set(self.objects)

        attribute_indices = [self.attribute_to_idx[attr] for attr in attributes if attr in self.attribute_to_idx]
        if not attribute_indices:
            return set()

        # Find objects that have ALL the attributes
        object_mask = np.all(self.incidence[:, attribute_indices], axis=1)
        return {self.objects[i] for i in np.where(object_mask)[0]}

    def get_attributes_of_objects(self, objects: Set[str]) -> Set[str]:
        """Get all attributes that are shared by all the given objects"""
        if not objects:
            return set(self.attributes)

        object_indices = [self.object_to_idx[obj] for obj in objects if obj in self.object_to_idx]
        if not object_indices:
            return set()

        # Find attributes that are present in ALL the objects
        attribute_mask = np.all(self.incidence[object_indices, :], axis=0)
        return {self.attributes[i] for i in np.where(attribute_mask)[0]}

class Concept:
    """Represents a formal concept with extent (objects) and intent (attributes)"""

    def __init__(self, extent: Set[str], intent: Set[str]):
        self.extent = extent  # Set of objects
        self.intent = intent  # Set of attributes
        self.extent_size = len(extent)
        self.intent_size = len(intent)

    def __eq__(self, other):
        return self.extent == other.extent and self.intent == other.intent

    def __hash__(self):
        return hash((frozenset(self.extent), frozenset(self.intent)))

    def __repr__(self):
        return f"Concept(extent={list(self.extent)[:3]}{'...' if len(self.extent) > 3 else ''}, intent={list(self.intent)})"

    def is_subconcept_of(self, other):
        """Check if this concept is a subconcept of another"""
        return self.extent.issubset(other.extent) and self.intent.issuperset(other.intent)

class ConceptLattice:
    """Represents a concept lattice"""

    def __init__(self, concepts: List[Concept], context: FormalContext):
        self.concepts = concepts
        self.context = context
        self.concept_to_idx = {concept: idx for idx, concept in enumerate(concepts)}
        self._build_lattice_structure()

    def _build_lattice_structure(self):
        """Build the lattice structure (subconcept/superconcept relationships)"""
        self.subconcepts = defaultdict(set)  # concept -> set of direct subconcepts
        self.superconcepts = defaultdict(set)  # concept -> set of direct superconcepts

        # For each pair of concepts, check subconcept relationship
        for i, concept1 in enumerate(self.concepts):
            for j, concept2 in enumerate(self.concepts):
                if i != j and concept1.is_subconcept_of(concept2):
                    # Check if it's a direct relationship (no intermediate concept)
                    is_direct = True
                    for k, concept3 in enumerate(self.concepts):
                        if k != i and k != j:
                            if (concept1.is_subconcept_of(concept3) and
                                concept3.is_subconcept_of(concept2) and
                                concept1 != concept3 and concept3 != concept2):
                                is_direct = False
                                break

                    if is_direct:
                        self.subconcepts[concept2].add(concept1)
                        self.superconcepts[concept1].add(concept2)

    def get_top_concept(self) -> Concept:
        """Get the top concept (maximum intent)"""
        return max(self.concepts, key=lambda c: len(c.intent))

    def get_bottom_concept(self) -> Concept:
        """Get the bottom concept (maximum extent)"""
        return max(self.concepts, key=lambda c: len(c.extent))

def create_formal_context_from_transactions(transactions: List[List[str]]) -> FormalContext:
    """Create a formal context from transaction data"""
    # Objects are transaction IDs, attributes are items
    objects = [f"T{i+1}" for i in range(len(transactions))]
    all_items = set()
    for transaction in transactions:
        all_items.update(transaction)
    attributes = sorted(list(all_items))

    # Create incidence matrix
    incidence = np.zeros((len(objects), len(attributes)), dtype=bool)
    for i, transaction in enumerate(transactions):
        for item in transaction:
            if item in attributes:
                j = attributes.index(item)
                incidence[i, j] = True

    return FormalContext(objects, attributes, incidence)

def generate_concepts_nextclosure(context: FormalContext) -> List[Concept]:
    """Generate all formal concepts using the Next Closure algorithm"""
    concepts = []
    attributes = context.attributes
    n_attributes = len(attributes)

    def closure(attribute_set: Set[str]) -> Set[str]:
        """Compute the closure of an attribute set"""
        objects = context.get_objects_with_attributes(attribute_set)
        return context.get_attributes_of_objects(objects)

    def next_closure(current: List[bool]) -> Optional[List[bool]]:
        """Find the next closure in lexicographic order"""
        for i in range(n_attributes - 1, -1, -1):
            if not current[i]:
                # Try to add attribute i
                test = current.copy()
                test[i] = True

                # Check if this is the closure
                attr_set = {attributes[j] for j, val in enumerate(test) if val}
                closure_set = closure(attr_set)
                closure_bool = [attr in closure_set for attr in attributes]

                # Check if it's lexicographically greater
                is_lex_greater = True
                for j in range(i):
                    if closure_bool[j] and not current[j]:
                        is_lex_greater = False
                        break

                if is_lex_greater and closure_bool == test:
                    return closure_bool

        return None

    # Start with empty set
    current = [False] * n_attributes
    current_set = set()
    closure_set = closure(current_set)
    current = [attr in closure_set for attr in attributes]

    while current is not None:
        # Create concept
        attr_set = {attributes[i] for i, val in enumerate(current) if val}
        obj_set = context.get_objects_with_attributes(attr_set)
        concepts.append(Concept(obj_set, attr_set))

        # Get next closure
        current = next_closure(current)

    return concepts

def build_concept_lattice(context, objects, attributes, max_concepts=50):
    """Build a concept lattice from binary context matrix"""
    try:
        # Create transaction lists from the binary matrix
        transactions = []
        for i in range(len(context)):
            transaction = []
            for j in range(len(attributes)):
                if context[i][j]:
                    transaction.append(attributes[j])
            if transaction:  # Only add non-empty transactions
                transactions.append(transaction)

        if not transactions:
            return []

        # Limit the number of transactions if too many
        if len(transactions) > max_concepts:
            transactions = transactions[:max_concepts]

        formal_context = create_formal_context_from_transactions(transactions)
        concepts = generate_concepts_nextclosure(formal_context)

        # Limit concepts if too many
        if len(concepts) > max_concepts:
            concepts = concepts[:max_concepts]

        return ConceptLattice(concepts, formal_context)

    except Exception as e:
        print(f"Error building concept lattice: {e}")
        return []

def lattice_to_json(lattice) -> Dict[str, Any]:
    """Convert concept lattice to JSON format for visualization"""
    if not lattice or not hasattr(lattice, 'concepts'):
        return {"nodes": [], "edges": [], "stats": {"total_concepts": 0}}

    nodes = []
    edges = []

    for i, concept in enumerate(lattice.concepts):
        nodes.append({
            "id": i,
            "extent": list(concept.extent),
            "intent": list(concept.intent),
            "extent_size": concept.extent_size,
            "intent_size": concept.intent_size,
            "label": f"({concept.extent_size},{concept.intent_size})",
            "is_top": concept == lattice.get_top_concept(),
            "is_bottom": concept == lattice.get_bottom_concept()
        })

    for concept, subconcepts in lattice.subconcepts.items():
        concept_idx = lattice.concept_to_idx[concept]
        for subconcept in subconcepts:
            subconcept_idx = lattice.concept_to_idx[subconcept]
            edges.append({
                "source": subconcept_idx,
                "target": concept_idx,
                "type": "subconcept"
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_concepts": len(lattice.concepts),
            "total_objects": len(lattice.context.objects),
            "total_attributes": len(lattice.context.attributes),
            "top_concept": lattice.concept_to_idx[lattice.get_top_concept()],
            "bottom_concept": lattice.concept_to_idx[lattice.get_bottom_concept()]
        }
    }
