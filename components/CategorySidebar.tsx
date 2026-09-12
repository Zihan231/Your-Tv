'use client';

import { useState } from 'react';
import type { Category } from '@/types/iptv';
import styles from './CategorySidebar.module.css';
import {
  FaFutbol,
  FaStar,
  FaGlobe,
  FaList,
  FaFolder,
  FaNewspaper,
  FaTrophy,
  FaFilm,
  FaMusic,
  FaChild,
  FaHistory,
  FaGraduationCap,
  FaTheaterMasks,
  FaTv,
  FaHeart,
  FaPlane,
  FaPray,
  FaBriefcase,
  FaCloudSun,
  FaShoppingCart,
  FaCar,
  FaUtensils,
  FaMicrochip,
  FaUsers,
  FaPalette,
  FaMapMarkerAlt,
  FaLandmark,
  FaGamepad,
  FaLock,
  FaCameraRetro,
  FaTree,
  FaSpa,
  FaMousePointer,
} from 'react-icons/fa';

function getCategoryIcon(id: string, className: string) {
  switch (id.toLowerCase()) {
    case 'live-events':
      return <FaFutbol className={className} style={{ color: '#38bdf8' }} />;
    case 'news':
      return <FaNewspaper className={className} />;
    case 'sports':
      return <FaTrophy className={className} />;
    case 'movies':
    case 'movie':
      return <FaFilm className={className} />;
    case 'music':
      return <FaMusic className={className} />;
    case 'kids':
    case 'animation':
      return <FaChild className={className} />;
    case 'documentary':
      return <FaHistory className={className} />;
    case 'education':
    case 'science':
      return <FaGraduationCap className={className} />;
    case 'entertainment':
      return <FaTheaterMasks className={className} />;
    case 'comedy':
      return <FaTv className={className} />;
    case 'lifestyle':
      return <FaHeart className={className} />;
    case 'travel':
      return <FaPlane className={className} />;
    case 'religion':
    case 'religious':
      return <FaPray className={className} />;
    case 'business':
    case 'politics':
      return <FaBriefcase className={className} />;
    case 'weather':
      return <FaCloudSun className={className} />;
    case 'shop':
    case 'shopping':
      return <FaShoppingCart className={className} />;
    case 'auto':
      return <FaCar className={className} />;
    case 'cooking':
    case 'food':
      return <FaUtensils className={className} />;
    case 'technology':
      return <FaMicrochip className={className} />;
    case 'family':
      return <FaUsers className={className} />;
    case 'general':
      return <FaTv className={className} />;
    case 'culture':
      return <FaPalette className={className} />;
    case 'local':
    case 'regional':
      return <FaMapMarkerAlt className={className} />;
    case 'legislative':
      return <FaLandmark className={className} />;
    case 'series':
      return <FaFilm className={className} />;
    case 'hobbies':
      return <FaGamepad className={className} />;
    case 'xxx':
    case 'adult':
      return <FaLock className={className} />;
    case 'classic':
      return <FaCameraRetro className={className} />;
    case 'outdoor':
      return <FaTree className={className} />;
    case 'public':
      return <FaUsers className={className} />;
    case 'relax':
      return <FaSpa className={className} />;
    case 'interactive':
      return <FaMousePointer className={className} />;
    default:
      return <FaFolder className={className} />;
  }
}


interface CountryItem {
  code: string;
  name: string;
  flag: string;
}

interface CategorySidebarProps {
  categories: Category[];
  counts: Map<string, number>;
  totalCount: number;
  active: string;
  onSelect: (id: string) => void;
  activeCountry: string;
  onCountrySelect: (code: string) => void;
  countries: CountryItem[];
  favoriteCount: number;
}

export default function CategorySidebar({
  categories,
  counts,
  totalCount,
  active,
  onSelect,
  activeCountry,
  onCountrySelect,
  countries,
  favoriteCount,
}: CategorySidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCountry = countries.find((c) => c.code === activeCountry) || {
    code: 'all',
    name: 'All Countries',
    flag: '',
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="YourTv Logo" className={styles.brandLogo} />
      </div>

      <div className={styles.countrySection}>
        <div className={styles.dropdown}>
          <button
            className={styles.dropdownToggle}
            onClick={() => setIsOpen((prev) => !prev)}
            type="button"
          >
            <span className={styles.selectedLabel}>
              {selectedCountry.flag ? (
                <span className={styles.flagIcon}>{selectedCountry.flag}</span>
              ) : (
                <FaGlobe className={styles.globeIcon} />
              )}
              <span className={styles.selectedCountryName}>{selectedCountry.name}</span>
            </span>
            <span className={styles.chevron}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {isOpen && (
            <>
              <div className={styles.backdrop} onClick={() => { setIsOpen(false); setSearchQuery(''); }} />
              <div className={styles.dropdownMenu}>
                <input
                  type="text"
                  className={styles.dropdownSearch}
                  placeholder="Search country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <div className={styles.dropdownList}>
                  {filteredCountries.map((c) => (
                    <div
                      key={c.code}
                      className={`${styles.dropdownItem} ${
                        c.code === activeCountry ? styles.dropdownItemActive : ''
                      }`}
                      onClick={() => {
                        onCountrySelect(c.code);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span className={styles.flag}>{c.flag || <FaGlobe />}</span>
                      <span className={styles.countryName}>{c.name}</span>
                    </div>
                  ))}
                  {filteredCountries.length === 0 && (
                    <div className={styles.noResults}>No countries found</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <button className={styles.header}>Categories</button>
      <button
        className={`${styles.item} ${active === 'all' ? styles.active : ''}`}
        onClick={() => onSelect('all')}
      >
        <FaList className={styles.itemIcon} />
        <span className={styles.itemName}>All</span>
        <span className={styles.count}>({totalCount})</span>
      </button>
      <button
        className={`${styles.item} ${active === 'favorites' ? styles.active : ''}`}
        onClick={() => onSelect('favorites')}
      >
        <FaStar className={styles.itemIcon} style={{ color: active === 'favorites' ? '#fbbf24' : 'inherit' }} />
        <span className={styles.itemName}>Favorites</span>
        <span className={styles.count}>({favoriteCount})</span>
      </button>
      {categories.map((cat) => {
        const c = counts.get(cat.id);
        if (c === undefined || c === 0) return null;
        return (
          <button
            key={cat.id}
            className={`${styles.item} ${
              active === cat.id ? styles.active : ''
            }`}
            onClick={() => onSelect(cat.id)}
          >
            {getCategoryIcon(cat.id, styles.itemIcon)}
            <span className={styles.itemName}>{cat.name}</span>
            <span className={styles.count}>({c})</span>
          </button>
        );
      })}
    </aside>
  );
}