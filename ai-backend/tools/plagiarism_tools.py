import math
import re
from typing import List, Dict, Any

STOP_WORDS = {
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
    'than', 'its', 'over', 'such', 'that', 'this', 'with', 'will', 'each',
    'from', 'they', 'were', 'which', 'their', 'said', 'what', 'about',
    'would', 'make', 'like', 'into', 'could', 'time', 'very', 'when',
    'come', 'made', 'find', 'more', 'also', 'then', 'just', 'only',
    'using', 'based', 'system', 'project', 'use', 'used', 'application',
}

def tokenize(text: str) -> List[str]:
    if not text:
        return []
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = text.split()
    return [w for w in tokens if len(w) > 2 and w not in STOP_WORDS]


def compute_tf(tokens: List[str]) -> Dict[str, float]:
    if not tokens:
        return {}
    freq = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    max_freq = max(freq.values()) if freq else 1
    tf = {}
    for term, count in freq.items():
        tf[term] = count / max_freq
    return tf


def compute_idf(all_docs: List[List[str]]) -> Dict[str, float]:
    n = len(all_docs)
    doc_freq = {}
    for doc in all_docs:
        seen = set(doc)
        for term in seen:
            doc_freq[term] = doc_freq.get(term, 0) + 1
    idf = {}
    for term, df in doc_freq.items():
        idf[term] = math.log((n + 1) / (df + 1)) + 1
    return idf


def compute_tfidf(tf: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
    vec = {}
    for term, tf_val in tf.items():
        vec[term] = tf_val * idf.get(term, 1.0)
    return vec


def cosine_similarity(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    all_terms = set(vec_a.keys()).union(set(vec_b.keys()))
    dot_product = 0.0
    mag_a = 0.0
    mag_b = 0.0

    for term in all_terms:
        a = vec_a.get(term, 0.0)
        b = vec_b.get(term, 0.0)
        dot_product += a * b
        mag_a += a * a
        mag_b += b * b

    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot_product / (math.sqrt(mag_a) * math.sqrt(mag_b))


def check_project_similarity(target_project: Dict[str, Any], all_projects: List[Dict[str, Any]], threshold: float = 0.40) -> Dict[str, Any]:
    """
    Compare a target project against all existing projects.
    Returns the top similar projects.
    """
    # Remove target project from existing to avoid comparing with itself
    existing_projects = [p for p in all_projects if p.get("id") != target_project.get("id")]
    
    if not existing_projects:
        return {"isUnique": True, "similarProjects": []}

    target_title = target_project.get("title", "")
    target_abstract = target_project.get("abstract", "")
    target_domain = target_project.get("domain", "")
    
    new_text = f"{target_title} {target_abstract} {target_domain}"
    new_tokens = tokenize(new_text)

    if not new_tokens:
        return {"isUnique": True, "similarProjects": []}

    new_title_tokens = tokenize(target_title)
    new_abstract_tokens = tokenize(target_abstract)

    existing_texts = []
    for p in existing_projects:
        title = p.get("title", "")
        abstract = p.get("abstract", "")
        domain = p.get("domain", "")
        combined = f"{title} {abstract} {domain}"
        
        existing_texts.append({
            "id": p.get("id"),
            "title": title,
            "abstract": abstract,
            "domain": domain,
            "groupName": p.get("group", {}).get("name", "") if isinstance(p.get("group"), dict) else "",
            "tokens": tokenize(combined),
            "titleTokens": tokenize(title),
            "abstractTokens": tokenize(abstract),
        })

    all_docs = [new_tokens] + [e["tokens"] for e in existing_texts]
    idf = compute_idf(all_docs)

    new_tf = compute_tf(new_tokens)
    new_vec = compute_tfidf(new_tf, idf)

    similar_projects = []
    for existing in existing_texts:
        if not existing["tokens"]:
            continue
            
        exist_tf = compute_tf(existing["tokens"])
        exist_vec = compute_tfidf(exist_tf, idf)
        
        similarity = cosine_similarity(new_vec, exist_vec)

        if similarity >= threshold:
            title_sim = 0.0
            if new_title_tokens and existing["titleTokens"]:
                t_idf = compute_idf([new_title_tokens, existing["titleTokens"]])
                title_sim = cosine_similarity(
                    compute_tfidf(compute_tf(new_title_tokens), t_idf),
                    compute_tfidf(compute_tf(existing["titleTokens"]), t_idf)
                )
                
            abstract_sim = 0.0
            if new_abstract_tokens and existing["abstractTokens"]:
                a_idf = compute_idf([new_abstract_tokens, existing["abstractTokens"]])
                abstract_sim = cosine_similarity(
                    compute_tfidf(compute_tf(new_abstract_tokens), a_idf),
                    compute_tfidf(compute_tf(existing["abstractTokens"]), a_idf)
                )

            common_terms = []
            for term in new_vec.keys():
                if term in exist_vec and new_vec[term] > 0.1:
                    common_terms.append(term)
                    
            common_terms.sort(key=lambda x: new_vec.get(x, 0) + exist_vec.get(x, 0), reverse=True)

            similar_projects.append({
                "id": existing["id"],
                "title": existing["title"],
                "abstract": existing["abstract"],
                "domain": existing["domain"],
                "groupName": existing["groupName"],
                "similarity": round(similarity * 100),
                "titleSimilarity": round(title_sim * 100),
                "abstractSimilarity": round(abstract_sim * 100),
                "commonTerms": common_terms[:8],
            })

    similar_projects.sort(key=lambda x: x["similarity"], reverse=True)

    return {
        "isUnique": len(similar_projects) == 0,
        "similarProjects": similar_projects[:5]
    }
